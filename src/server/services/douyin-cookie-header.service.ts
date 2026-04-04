import { AppError } from "@/lib/errors";
import {
  douyinLoginStateStorageService,
  type DouyinStorageState,
  type DouyinStorageStateCookie,
} from "@/server/services/douyin-login-state-storage.service";

class DouyinCookieHeaderService {
  async buildFromStateFile(filePath: string): Promise<string> {
    const storageState = await douyinLoginStateStorageService.readStorageState(filePath);
    return this.buildFromStorageState(storageState);
  }

  buildFromStorageState(storageState: DouyinStorageState): string {
    const nowInSeconds = Date.now() / 1000;
    const cookieMap = new Map<string, string>();

    for (const cookie of storageState.cookies) {
      if (!this.isRelevantCookie(cookie)) {
        continue;
      }

      if (Number.isFinite(cookie.expires) && cookie.expires > 0 && cookie.expires <= nowInSeconds) {
        continue;
      }

      cookieMap.set(cookie.name, cookie.value);
    }

    const cookieHeader = Array.from(cookieMap.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");

    if (!cookieHeader) {
      throw new AppError("INVALID_LOGIN_STATE", "账号登录态无可用 Cookie，请重新登录", 500);
    }

    return cookieHeader;
  }

  private isRelevantCookie(cookie: DouyinStorageStateCookie): boolean {
    const normalizedDomain = cookie.domain.replace(/^\./, "").toLowerCase();

    return (
      normalizedDomain.endsWith("douyin.com") ||
      normalizedDomain.endsWith("iesdouyin.com") ||
      normalizedDomain.endsWith("amemv.com")
    );
  }
}

export const douyinCookieHeaderService = new DouyinCookieHeaderService();