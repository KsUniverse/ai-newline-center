import { DouyinLoginSessionStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { launchMock, ensureReadyMock } = vi.hoisted(() => ({
  launchMock: vi.fn(),
  ensureReadyMock: vi.fn(),
}));

vi.mock("playwright", () => ({
  chromium: {
    launch: launchMock,
  },
}));

vi.mock("@/server/services/douyin-login-state-storage.service", () => ({
  douyinLoginStateStorageService: {
    ensureReady: ensureReadyMock,
  },
}));

interface MockPageState {
  currentUrl: string;
  bodyText: string;
  closed: boolean;
  evaluateQueue: unknown[];
}

function createBrowserHarness(pageState: MockPageState) {
  const events: Record<string, Array<(value: unknown) => void>> = {};

  const baseLocator = {
    first: vi.fn(() => baseLocator),
    count: vi.fn(async () => 0),
    waitFor: vi.fn(async () => undefined),
    getAttribute: vi.fn(async () => null),
    evaluate: vi.fn(async () => null),
    locator: vi.fn(() => baseLocator),
    filter: vi.fn(() => baseLocator),
    click: vi.fn(async () => undefined),
    innerText: vi.fn(async () => pageState.bodyText),
  };

  const page = {
    goto: vi.fn(async (url: string) => {
      pageState.currentUrl = url;
    }),
    waitForLoadState: vi.fn(async () => undefined),
    waitForTimeout: vi.fn(async () => undefined),
    reload: vi.fn(async () => undefined),
    evaluate: vi.fn(async () => pageState.evaluateQueue.shift() ?? null),
    locator: vi.fn((selector?: string) => {
      if (selector === "body") {
        return {
          ...baseLocator,
          innerText: vi.fn(async () => pageState.bodyText),
        };
      }

      return baseLocator;
    }),
    getByText: vi.fn(() => baseLocator),
    getByRole: vi.fn(() => baseLocator),
    url: vi.fn(() => pageState.currentUrl),
    isClosed: vi.fn(() => pageState.closed),
    on: vi.fn((event: string, handler: (value: unknown) => void) => {
      events[event] ??= [];
      events[event].push(handler);
    }),
    close: vi.fn(async () => {
      pageState.closed = true;
    }),
  };

  const context = {
    newPage: vi.fn(async () => page),
    storageState: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };

  const browser = {
    newContext: vi.fn(async () => context),
    close: vi.fn(async () => undefined),
  };

  return {
    browser,
    context,
    page,
    events,
  };
}

describe("douyinLoginSessionManager", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as typeof globalThis & {
      __douyinLoginSessionManager?: unknown;
    }).__douyinLoginSessionManager;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T08:00:00.000Z"));
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ai_newline");
    vi.stubEnv("NEXTAUTH_SECRET", "a".repeat(32));
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DOUYIN_LOGIN_TIMEOUT_MS", "60000");
    vi.stubEnv("DOUYIN_LOGIN_PAGE_URL", "https://creator.douyin.com/");
    launchMock.mockReset();
    ensureReadyMock.mockReset();
    ensureReadyMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("expires abandoned sessions after server-side ttl cleanup", async () => {
    const runtimeProbe = {
      close: vi.fn(async () => undefined),
    };
    const pageState: MockPageState = {
      currentUrl: "https://creator.douyin.com/",
      bodyText: "请使用抖音 App 扫码登录",
      closed: false,
      evaluateQueue: ["data:image/png;base64,qr-ready"],
    };
    const sessionHarness = createBrowserHarness(pageState);

    launchMock.mockResolvedValueOnce(runtimeProbe).mockResolvedValueOnce(sessionHarness.browser);

    const { douyinLoginSessionManager } = await import(
      "@/server/services/douyin-login-session-manager"
    );

    const snapshot = await douyinLoginSessionManager.startSession("login_session_1");
    expect(snapshot.status).toBe(DouyinLoginSessionStatus.QRCODE_READY);

    await vi.advanceTimersByTimeAsync(60_010);

    const expiredSnapshot = await douyinLoginSessionManager.pollSession(
      "login_session_1",
      "D:/private/tmp/login_session_1.json",
    );

    expect(expiredSnapshot.status).toBe(DouyinLoginSessionStatus.EXPIRED);
    expect(sessionHarness.page.close).toHaveBeenCalled();
    expect(sessionHarness.context.close).toHaveBeenCalled();
    expect(sessionHarness.browser.close).toHaveBeenCalled();
  });

  it("resolves identity only from the captured favorite request", async () => {
    const runtimeProbe = {
      close: vi.fn(async () => undefined),
    };
    const pageState: MockPageState = {
      currentUrl: "https://www.douyin.com/",
      bodyText: "请使用抖音 App 扫码登录",
      closed: false,
      evaluateQueue: ["data:image/png;base64,qr-ready", true],
    };
    const sessionHarness = createBrowserHarness(pageState);

    launchMock.mockResolvedValueOnce(runtimeProbe).mockResolvedValueOnce(sessionHarness.browser);
    vi.stubEnv("DOUYIN_LOGIN_PAGE_URL", "https://www.douyin.com/");

    const { douyinLoginSessionManager } = await import(
      "@/server/services/douyin-login-session-manager"
    );

    await douyinLoginSessionManager.startSession("login_session_2");

    sessionHarness.events.request?.[0]?.({
      resourceType: () => "fetch",
      url: () =>
        "https://www.douyin.com/aweme/v1/web/aweme/favorite/?sec_user_id=sec_user_1&max_cursor=0",
      headers: () => ({
        cookie: "sessionid=abc123; uid_tt=xyz456",
      }),
    });

    const identity = await douyinLoginSessionManager.resolveIdentity("login_session_2");

    expect(identity).toEqual({
      secUserId: "sec_user_1",
      displayName: null,
      douyinNumber: null,
      rawCookie: "sessionid=abc123; uid_tt=xyz456",
    });
  });

  it("confirms the session only after persisted state validation succeeds", async () => {
    const runtimeProbe = {
      close: vi.fn(async () => undefined),
    };
    const pageState: MockPageState = {
      currentUrl: "https://creator.douyin.com/creator-micro/content/upload",
      bodyText: "创作者中心",
      closed: false,
      evaluateQueue: ["data:image/png;base64,qr-ready"],
    };
    const verificationPageState: MockPageState = {
      currentUrl: "https://creator.douyin.com/creator-micro/content/upload",
      bodyText: "创作者中心",
      closed: false,
      evaluateQueue: [],
    };
    const sessionHarness = createBrowserHarness(pageState);
    const verificationHarness = createBrowserHarness(verificationPageState);

    launchMock
      .mockResolvedValueOnce(runtimeProbe)
      .mockResolvedValueOnce(sessionHarness.browser)
      .mockResolvedValueOnce(verificationHarness.browser);

    const { douyinLoginSessionManager } = await import(
      "@/server/services/douyin-login-session-manager"
    );

    await douyinLoginSessionManager.startSession("login_session_3");
    pageState.currentUrl = "https://creator.douyin.com/creator-micro/content/upload";

    const snapshot = await douyinLoginSessionManager.pollSession(
      "login_session_3",
      "D:/private/tmp/login_session_3.json",
    );

    expect(snapshot.status).toBe(DouyinLoginSessionStatus.CONFIRMED);
    expect(sessionHarness.context.storageState).toHaveBeenCalledWith({
      path: "D:/private/tmp/login_session_3.json",
    });
  });
});
