import { beforeEach, describe, expect, it, vi } from "vitest";

describe("douyinCookieHeaderService", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ai_newline");
    vi.stubEnv("NEXTAUTH_SECRET", "a".repeat(32));
    vi.stubEnv("NODE_ENV", "test");
  });

  it("builds a cookie header from valid douyin cookies only", async () => {
    const { douyinCookieHeaderService } = await import(
      "@/server/services/douyin-cookie-header.service"
    );
    const future = Date.now() / 1000 + 60 * 60;

    const result = douyinCookieHeaderService.buildFromStorageState({
      cookies: [
        {
          name: "sessionid",
          value: "session-123",
          domain: ".douyin.com",
          path: "/",
          expires: future,
        },
        {
          name: "uid_tt",
          value: "uid-456",
          domain: "creator.douyin.com",
          path: "/",
          expires: future,
        },
        {
          name: "ignore_me",
          value: "off-domain",
          domain: ".example.com",
          path: "/",
          expires: future,
        },
        {
          name: "expired_cookie",
          value: "expired",
          domain: ".douyin.com",
          path: "/",
          expires: 1,
        },
      ],
    });

    expect(result).toBe("sessionid=session-123; uid_tt=uid-456");
  });

  it("throws when no valid douyin cookies are available", async () => {
    const { douyinCookieHeaderService } = await import(
      "@/server/services/douyin-cookie-header.service"
    );

    expect(() =>
      douyinCookieHeaderService.buildFromStorageState({
        cookies: [
          {
            name: "ignore_me",
            value: "off-domain",
            domain: ".example.com",
            path: "/",
            expires: Date.now() / 1000 + 60,
          },
        ],
      }),
    ).toThrow(/无可用 Cookie/);
  });
});