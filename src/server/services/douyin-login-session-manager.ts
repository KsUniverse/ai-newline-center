import { DouyinLoginSessionStatus } from "@prisma/client";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { douyinLoginStateStorageService } from "@/server/services/douyin-login-state-storage.service";

const LOGIN_PROMPT_KEYWORDS = ["扫码登录", "手机号登录", "验证码登录", "打开抖音扫码"];
const LOGIN_EXPIRED_KEYWORDS = ["二维码已失效", "二维码过期", "刷新二维码"];
const LOGIN_SCANNED_KEYWORDS = ["已扫码", "请在手机上确认", "在手机上确认", "扫码成功"];
const DOUYIN_CREATOR_UPLOAD_URL = "https://creator.douyin.com/creator-micro/content/upload";
const DOUYIN_CREATOR_HOME_URL_PREFIX = "https://creator.douyin.com/creator-micro/home";
const DOUYIN_HOMEPAGE_URL_PREFIX = "https://www.douyin.com/";
const LOGIN_QRCODE_WAIT_MS = 30_000;
const POLL_QRCODE_WAIT_MS = 200;
const TERMINAL_SNAPSHOT_RETENTION_MS = 10 * 60 * 1000;

interface ManagedLoginSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  expiresAt: Date;
  lastQrcodeDataUrl: string | null;
  expirationTimer: ReturnType<typeof setTimeout> | null;
  favoriteSnapshot: FavoriteSnapshot | null;
}

interface FavoriteSnapshot {
  requestUrl: string;
  requestCookie: string | null;
  secUserId: string | null;
}

interface ManagedTerminalLoginSession {
  snapshot: LoginSessionRuntimeSnapshot;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

export interface LoginSessionRuntimeSnapshot {
  status: DouyinLoginSessionStatus;
  qrcodeDataUrl: string | null;
  expiresAt: Date | null;
  currentUrl: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface LoginSessionResolvedIdentity {
  secUserId: string | null;
  displayName: string | null;
  douyinNumber: string | null;
  rawCookie: string | null;
}

class DouyinLoginSessionManager {
  private readonly sessions = new Map<string, ManagedLoginSession>();

  private readonly terminalSnapshots = new Map<string, ManagedTerminalLoginSession>();

  private runtimeValidatedAt: number | null = null;

  async ensureRuntimeReady(): Promise<void> {
    await douyinLoginStateStorageService.ensureReady();

    if (this.runtimeValidatedAt && Date.now() - this.runtimeValidatedAt < 5 * 60 * 1000) {
      return;
    }

    let browser: Browser | null = null;

    try {
      browser = await chromium.launch({ headless: true });
      this.runtimeValidatedAt = Date.now();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("Executable doesn't exist")) {
        throw new AppError(
          "PLAYWRIGHT_RUNTIME_UNAVAILABLE",
          "Chromium 未安装，请先执行 pnpm exec playwright install chromium",
          500,
        );
      }

      throw new AppError(
        "PLAYWRIGHT_RUNTIME_UNAVAILABLE",
        "Chromium 无法启动，请检查 Playwright 运行环境和目录权限",
        500,
      );
    } finally {
      await browser?.close().catch(() => undefined);
    }
  }

  async startSession(loginSessionId: string): Promise<LoginSessionRuntimeSnapshot> {
    await this.ensureRuntimeReady();
    await this.disposeSession(loginSessionId);
    this.clearTerminalSnapshot(loginSessionId);

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let sessionRegistered = false;

    try {
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext();
      page = await context.newPage();

      await page.goto(env.DOUYIN_LOGIN_PAGE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      await this.ensureLoginEntryReady(page);

      let qrcodeDataUrl = await this.extractQrcodeDataUrl(page, LOGIN_QRCODE_WAIT_MS);
      if (!qrcodeDataUrl) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
        await this.ensureLoginEntryReady(page);
        qrcodeDataUrl = await this.extractQrcodeDataUrl(page, LOGIN_QRCODE_WAIT_MS);
      }

      if (!qrcodeDataUrl) {
        throw new AppError("DOUYIN_QRCODE_NOT_FOUND", "未能获取抖音登录二维码，请稍后重试", 502);
      }

      const managedSession: ManagedLoginSession = {
        browser,
        context,
        page,
        expiresAt: new Date(Date.now() + env.DOUYIN_LOGIN_TIMEOUT_MS),
        lastQrcodeDataUrl: qrcodeDataUrl,
        expirationTimer: null,
        favoriteSnapshot: null,
      };

      page.on("request", (request) => {
        const resourceType = request.resourceType();
        if (resourceType !== "xhr" && resourceType !== "fetch") {
          return;
        }

        const requestUrl = request.url();
        if (!requestUrl.includes("/aweme/") || !requestUrl.includes("favorite")) {
          return;
        }

        try {
          const parsedUrl = new URL(requestUrl);
          managedSession.favoriteSnapshot = {
            requestUrl,
            requestCookie: request.headers()["cookie"] ?? null,
            secUserId: parsedUrl.searchParams.get("sec_user_id"),
          };
        } catch {
          managedSession.favoriteSnapshot = null;
        }
      });

      this.sessions.set(loginSessionId, managedSession);
      sessionRegistered = true;
      this.scheduleExpiry(loginSessionId);

      return {
        status: DouyinLoginSessionStatus.QRCODE_READY,
        qrcodeDataUrl,
        expiresAt: managedSession.expiresAt,
        currentUrl: page.url(),
      };
    } catch (error) {
      if (sessionRegistered) {
        await this.disposeSession(loginSessionId);
      } else {
        await page?.close().catch(() => undefined);
        await context?.close().catch(() => undefined);
        await browser?.close().catch(() => undefined);
      }

      throw error;
    }
  }

  async refreshSession(loginSessionId: string): Promise<LoginSessionRuntimeSnapshot> {
    const session = this.sessions.get(loginSessionId);
    if (!session) {
      return this.startSession(loginSessionId);
    }

    try {
      session.favoriteSnapshot = null;
      await session.page.goto(env.DOUYIN_LOGIN_PAGE_URL, { waitUntil: "domcontentloaded" });
      await session.page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      await this.ensureLoginEntryReady(session.page);

      const qrcodeDataUrl = await this.extractQrcodeDataUrl(session.page, LOGIN_QRCODE_WAIT_MS);
      if (!qrcodeDataUrl) {
        throw new AppError("DOUYIN_QRCODE_NOT_FOUND", "未能刷新登录二维码，请稍后重试", 502);
      }

      session.lastQrcodeDataUrl = qrcodeDataUrl;
      session.expiresAt = new Date(Date.now() + env.DOUYIN_LOGIN_TIMEOUT_MS);
      this.scheduleExpiry(loginSessionId);

      return {
        status: DouyinLoginSessionStatus.QRCODE_READY,
        qrcodeDataUrl,
        expiresAt: session.expiresAt,
        currentUrl: session.page.url(),
      };
    } catch (error) {
      await this.disposeSession(loginSessionId);
      throw error;
    }
  }

  async pollSession(
    loginSessionId: string,
    tempStatePath: string,
  ): Promise<LoginSessionRuntimeSnapshot> {
    const terminalSnapshot = this.terminalSnapshots.get(loginSessionId);
    if (terminalSnapshot) {
      return terminalSnapshot.snapshot;
    }

    const session = this.sessions.get(loginSessionId);
    if (!session) {
      return {
        status: DouyinLoginSessionStatus.FAILED,
        qrcodeDataUrl: null,
        expiresAt: null,
        currentUrl: null,
        errorCode: "LOGIN_SESSION_RUNTIME_MISSING",
        errorMessage: "登录会话已中断，请重新发起",
      };
    }

    if (session.page.isClosed()) {
      return {
        status: DouyinLoginSessionStatus.FAILED,
        qrcodeDataUrl: session.lastQrcodeDataUrl,
        expiresAt: session.expiresAt,
        currentUrl: null,
        errorCode: "LOGIN_SESSION_PAGE_CLOSED",
        errorMessage: "登录页面已关闭，请重新发起",
      };
    }

    if (Date.now() >= session.expiresAt.getTime()) {
      return {
        status: DouyinLoginSessionStatus.EXPIRED,
        qrcodeDataUrl: session.lastQrcodeDataUrl,
        expiresAt: session.expiresAt,
        currentUrl: session.page.url(),
      };
    }

    const currentUrl = session.page.url();
    const bodyText = await this.readBodyText(session.page);

    if (await this.isLoggedIn(session, bodyText, tempStatePath)) {
      return {
        status: DouyinLoginSessionStatus.CONFIRMED,
        qrcodeDataUrl: session.lastQrcodeDataUrl,
        expiresAt: session.expiresAt,
        currentUrl,
      };
    }

    if (this.containsKeywords(bodyText, LOGIN_EXPIRED_KEYWORDS)) {
      return {
        status: DouyinLoginSessionStatus.EXPIRED,
        qrcodeDataUrl: session.lastQrcodeDataUrl,
        expiresAt: session.expiresAt,
        currentUrl,
      };
    }

    if (
      this.containsKeywords(bodyText, LOGIN_SCANNED_KEYWORDS) ||
      bodyText.includes("需在手机上进行确认") ||
      bodyText.includes("取消登录") ||
      bodyText.includes("在手机上确认")
    ) {
      return {
        status: DouyinLoginSessionStatus.SCANNED,
        qrcodeDataUrl: session.lastQrcodeDataUrl,
        expiresAt: session.expiresAt,
        currentUrl,
      };
    }

    const qrcodeDataUrl =
      (await this.extractQrcodeDataUrl(session.page, POLL_QRCODE_WAIT_MS)) ?? session.lastQrcodeDataUrl;
    session.lastQrcodeDataUrl = qrcodeDataUrl;

    return {
      status: DouyinLoginSessionStatus.QRCODE_READY,
      qrcodeDataUrl,
      expiresAt: session.expiresAt,
      currentUrl,
    };
  }

  async resolveIdentity(loginSessionId: string): Promise<LoginSessionResolvedIdentity> {
    const session = this.sessions.get(loginSessionId);
    if (!session) {
      return this.emptyIdentity();
    }

    return this.resolveIdentityFromCapturedFavorite(session);
  }

  async cancelSession(loginSessionId: string): Promise<void> {
    await this.disposeSession(loginSessionId);
  }

  async finishSession(loginSessionId: string): Promise<void> {
    await this.disposeSession(loginSessionId);
  }

  private async resolveIdentityFromCapturedFavorite(
    session: ManagedLoginSession,
  ): Promise<LoginSessionResolvedIdentity> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const identity = this.resolveIdentityFromFavoriteSnapshot(session.favoriteSnapshot);
      if (identity.secUserId && identity.rawCookie) {
        return identity;
      }

      if (attempt === 0) {
        await this.triggerFavoriteRequest(session.page);
      }

      await session.page.waitForTimeout(300);
    }

    return this.emptyIdentity(session.favoriteSnapshot?.requestCookie ?? null);
  }

  private resolveIdentityFromFavoriteSnapshot(
    snapshot: FavoriteSnapshot | null,
  ): LoginSessionResolvedIdentity {
    if (!snapshot?.secUserId) {
      return this.emptyIdentity(snapshot?.requestCookie ?? null);
    }

    return {
      secUserId: snapshot.secUserId,
      displayName: null,
      douyinNumber: null,
      rawCookie: snapshot.requestCookie,
    };
  }

  private emptyIdentity(rawCookie: string | null = null): LoginSessionResolvedIdentity {
    return {
      secUserId: null,
      displayName: null,
      douyinNumber: null,
      rawCookie,
    };
  }

  private async triggerFavoriteRequest(page: Page): Promise<void> {
    if (!page.url().startsWith(DOUYIN_HOMEPAGE_URL_PREFIX)) {
      return;
    }

    try {
      await page.evaluate(() => {
        const isVisible = (element: Element) => {
          const htmlElement = element as HTMLElement;
          const style = window.getComputedStyle(htmlElement);
          const rect = htmlElement.getBoundingClientRect();

          return (
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            rect.width > 0 &&
            rect.height > 0
          );
        };

        const normalizeText = (value: string) => value.replace(/\s+/g, "");
        const candidates = Array.from(document.querySelectorAll("a, button, div, span")).filter(
          (element) => normalizeText((element.textContent ?? "").trim()) === "我的" && isVisible(element),
        );

        const target = candidates[0] as HTMLElement | undefined;
        target?.click();
      });
      await page.waitForTimeout(1_200);
    } catch {
      return;
    }
  }

  private async isLoggedIn(
    session: ManagedLoginSession,
    bodyText: string,
    tempStatePath: string,
  ): Promise<boolean> {
    if (this.containsKeywords(bodyText, LOGIN_PROMPT_KEYWORDS)) {
      return false;
    }

    const currentUrl = session.page.url();
    const looksAuthenticated =
      this.isCreatorAuthenticatedUrl(currentUrl) || (await this.isDouyinHomepageLoggedIn(session.page));

    if (!looksAuthenticated) {
      return false;
    }

    await douyinLoginStateStorageService.ensureReady();
    await session.context.storageState({ path: tempStatePath });
    return this.verifyPersistedLoginState(tempStatePath);
  }

  private async isDouyinHomepageLoggedIn(page: Page): Promise<boolean> {
    if (!page.url().startsWith(DOUYIN_HOMEPAGE_URL_PREFIX)) {
      return false;
    }

    try {
      return await page.evaluate(() => {
        const root = document.querySelector("#douyin-header-menuCt");
        if (!root) {
          return false;
        }

        const isVisible = (element: Element) => {
          const htmlElement = element as HTMLElement;
          const style = window.getComputedStyle(htmlElement);
          const rect = htmlElement.getBoundingClientRect();

          return (
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            rect.width > 0 &&
            rect.height > 0
          );
        };

        const hasLoginButton = Array.from(root.querySelectorAll("button, a, div, span")).some(
          (element) => {
            const text = (element.textContent ?? "").trim().replace(/\s+/g, "");
            return text === "登录" && isVisible(element);
          },
        );

        const hasUserAvatar = Array.from(root.querySelectorAll("img")).some((element) =>
          isVisible(element),
        );

        return !hasLoginButton && hasUserAvatar;
      });
    } catch {
      return false;
    }
  }

  private async verifyPersistedLoginState(tempStatePath: string): Promise<boolean> {
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext({ storageState: tempStatePath });
      page = await context.newPage();

      await page.goto(DOUYIN_CREATOR_UPLOAD_URL, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

      const bodyText = await this.readBodyText(page);
      if (this.containsKeywords(bodyText, LOGIN_PROMPT_KEYWORDS)) {
        return false;
      }

      return page.url().startsWith(DOUYIN_CREATOR_UPLOAD_URL) || this.isLoggedInUrl(page.url());
    } catch {
      return false;
    } finally {
      await page?.close().catch(() => undefined);
      await context?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);
    }
  }

  private async extractQrcodeDataUrl(page: Page, waitForVisibleMs: number): Promise<string | null> {
    const loginAreaQr = await this.extractQrcodeDataUrlFromLoginArea(page, waitForVisibleMs);
    if (loginAreaQr) {
      return loginAreaQr;
    }

    try {
      return await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll("img"));
        for (const image of images) {
          const src = image.getAttribute("src");
          const alt = (image.getAttribute("alt") ?? "").toLowerCase();
          const className = (image.getAttribute("class") ?? "").toLowerCase();

          if (!src) {
            continue;
          }

          if (src.startsWith("data:image/")) {
            return src;
          }

          if (
            src.startsWith("http") &&
            (src.toLowerCase().includes("qr") || alt.includes("二维码") || className.includes("qr"))
          ) {
            return src;
          }
        }

        const canvases = Array.from(document.querySelectorAll("canvas"));
        for (const canvasElement of canvases) {
          const canvas = canvasElement as HTMLCanvasElement;
          const width = canvas.width || canvas.clientWidth;
          const height = canvas.height || canvas.clientHeight;

          if (width >= 120 && height >= 120) {
            try {
              return canvas.toDataURL("image/png");
            } catch {
              continue;
            }
          }
        }

        const svgs = Array.from(document.querySelectorAll("svg"));
        for (const svgElement of svgs) {
          const width = Number(svgElement.getAttribute("width") ?? svgElement.clientWidth);
          const height = Number(svgElement.getAttribute("height") ?? svgElement.clientHeight);

          if (width >= 120 && height >= 120) {
            return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgElement.outerHTML)}`;
          }
        }

        return null;
      });
    } catch {
      return null;
    }
  }

  private async extractQrcodeDataUrlFromLoginArea(
    page: Page,
    waitForVisibleMs: number,
  ): Promise<string | null> {
    const selectors = [
      "#douyin_login_comp_scan_code img",
      "#douyin_login_comp_flat_panel img",
    ];

    for (const selector of selectors) {
      try {
        const image = page.locator(selector).first();
        if (!(await image.count())) {
          continue;
        }

        await image.waitFor({ state: "visible", timeout: waitForVisibleMs });
        const src = await image.getAttribute("src");
        if (src) {
          return src;
        }
      } catch {
        continue;
      }
    }

    try {
      const scanLoginTab = page.getByText("扫码登录", { exact: true }).first();
      await scanLoginTab.waitFor({ state: "visible", timeout: waitForVisibleMs });

      let qrcodeImage = scanLoginTab
        .locator("..")
        .locator("xpath=following-sibling::div[1]")
        .locator('img[aria-label="二维码"]')
        .first();

      if (!(await qrcodeImage.count())) {
        qrcodeImage = page.getByRole("img", { name: "二维码" }).first();
      }

      await qrcodeImage.waitFor({ state: "visible", timeout: waitForVisibleMs });
      const src = await qrcodeImage.getAttribute("src");
      if (src) {
        return src;
      }

      return await qrcodeImage.evaluate((element) => {
        if (!(element instanceof HTMLImageElement)) {
          return null;
        }

        return element.currentSrc || element.src || null;
      });
    } catch {
      return null;
    }
  }

  private async ensureLoginEntryReady(page: Page): Promise<void> {
    if (!page.url().startsWith(DOUYIN_HOMEPAGE_URL_PREFIX)) {
      return;
    }

    if (await this.extractQrcodeDataUrl(page, POLL_QRCODE_WAIT_MS)) {
      return;
    }

    await page.waitForTimeout(1_200);
    if (await this.extractQrcodeDataUrl(page, 1_500)) {
      return;
    }

    try {
      const clicked = await page.evaluate(() => {
        const isVisible = (element: Element) => {
          const htmlElement = element as HTMLElement;
          const style = window.getComputedStyle(htmlElement);
          const rect = htmlElement.getBoundingClientRect();

          return (
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            rect.width > 0 &&
            rect.height > 0
          );
        };

        const normalizeText = (value: string) => value.replace(/\s+/g, "");
        const candidates = Array.from(document.querySelectorAll("button, a, div, span")).filter(
          (element) => normalizeText((element.textContent ?? "").trim()) === "登录" && isVisible(element),
        );

        const target = candidates[0] as HTMLElement | undefined;
        target?.click();
        return Boolean(target);
      });

      if (clicked) {
        await page.waitForTimeout(800);
      }
    } catch {
      return;
    }
  }

  private async readBodyText(page: Page): Promise<string> {
    try {
      const text = await page.locator("body").innerText({ timeout: 2_000 });
      return text.toLowerCase();
    } catch {
      return "";
    }
  }

  private containsKeywords(bodyText: string, keywords: string[]): boolean {
    return keywords.some((keyword) => bodyText.includes(keyword.toLowerCase()));
  }

  private isLoggedInUrl(url: string | null): boolean {
    if (!url) {
      return false;
    }

    return this.isCreatorAuthenticatedUrl(url);
  }

  private isCreatorAuthenticatedUrl(url: string): boolean {
    try {
      if (url.startsWith(DOUYIN_CREATOR_HOME_URL_PREFIX)) {
        return true;
      }

      const parsedUrl = new URL(url);
      if (parsedUrl.hostname.toLowerCase() !== "creator.douyin.com") {
        return false;
      }

      const normalizedPath = parsedUrl.pathname.toLowerCase();
      return normalizedPath.startsWith("/creator-micro/") && !normalizedPath.includes("login");
    } catch {
      return false;
    }
  }

  private scheduleExpiry(loginSessionId: string): void {
    const session = this.sessions.get(loginSessionId);
    if (!session) {
      return;
    }

    if (session.expirationTimer) {
      clearTimeout(session.expirationTimer);
    }

    const timeoutMs = Math.max(session.expiresAt.getTime() - Date.now(), 0);
    session.expirationTimer = setTimeout(() => {
      void this.expireSession(loginSessionId);
    }, timeoutMs);
  }

  private async expireSession(loginSessionId: string): Promise<void> {
    const session = this.sessions.get(loginSessionId);
    if (!session) {
      return;
    }

    this.cacheTerminalSnapshot(loginSessionId, {
      status: DouyinLoginSessionStatus.EXPIRED,
      qrcodeDataUrl: session.lastQrcodeDataUrl,
      expiresAt: session.expiresAt,
      currentUrl: session.page.url(),
      errorCode: "LOGIN_SESSION_EXPIRED",
      errorMessage: "二维码已失效，请刷新后重新扫码",
    });

    await this.disposeSession(loginSessionId);
  }

  private cacheTerminalSnapshot(loginSessionId: string, snapshot: LoginSessionRuntimeSnapshot): void {
    this.clearTerminalSnapshot(loginSessionId);

    const cleanupTimer = setTimeout(() => {
      this.clearTerminalSnapshot(loginSessionId);
    }, TERMINAL_SNAPSHOT_RETENTION_MS);

    this.terminalSnapshots.set(loginSessionId, {
      snapshot,
      cleanupTimer,
    });
  }

  private clearTerminalSnapshot(loginSessionId: string): void {
    const snapshot = this.terminalSnapshots.get(loginSessionId);
    if (!snapshot) {
      return;
    }

    if (snapshot.cleanupTimer) {
      clearTimeout(snapshot.cleanupTimer);
    }

    this.terminalSnapshots.delete(loginSessionId);
  }

  private async disposeSession(loginSessionId: string): Promise<void> {
    const session = this.sessions.get(loginSessionId);
    if (!session) {
      return;
    }

    this.sessions.delete(loginSessionId);
    if (session.expirationTimer) {
      clearTimeout(session.expirationTimer);
    }

    await session.page.close().catch(() => undefined);
    await session.context.close().catch(() => undefined);
    await session.browser.close().catch(() => undefined);
  }
}

declare global {
  var __douyinLoginSessionManager: DouyinLoginSessionManager | undefined;
}

export const douyinLoginSessionManager =
  globalThis.__douyinLoginSessionManager ?? new DouyinLoginSessionManager();

if (!globalThis.__douyinLoginSessionManager) {
  globalThis.__douyinLoginSessionManager = douyinLoginSessionManager;
}
