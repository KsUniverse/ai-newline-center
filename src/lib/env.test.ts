import { beforeEach, describe, expect, it, vi } from "vitest";

describe("parseEnv", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ai_newline");
    vi.stubEnv("NEXTAUTH_SECRET", "a".repeat(32));
  });

  it("allows NEXTAUTH_URL to be omitted in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { parseEnv } = await import("@/lib/env");
    const result = parseEnv({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ai_newline",
      NEXTAUTH_SECRET: "a".repeat(32),
      NODE_ENV: "development",
    });

    expect(result.NEXTAUTH_URL).toBeUndefined();
  });

  it("requires NEXTAUTH_URL in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXTAUTH_URL", "https://app.example.com");
    vi.stubEnv("CRAWLER_API_URL", "https://crawler.example.com");

    const { parseEnv } = await import("@/lib/env");
    expect(() =>
      parseEnv({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ai_newline",
        NEXTAUTH_SECRET: "a".repeat(32),
        CRAWLER_API_URL: "https://crawler.example.com",
        NODE_ENV: "production",
      }),
    ).toThrow(/NEXTAUTH_URL 在生产环境必填/);
  });

  it("allows CRAWLER_API_URL to be omitted in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { parseEnv } = await import("@/lib/env");
    const result = parseEnv({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ai_newline",
      NEXTAUTH_SECRET: "a".repeat(32),
      NODE_ENV: "development",
    });

    expect(result.CRAWLER_API_URL).toBeUndefined();
  });

  it("requires CRAWLER_API_URL in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXTAUTH_URL", "https://app.example.com");
    vi.stubEnv("CRAWLER_API_URL", "https://crawler.example.com");

    const { parseEnv } = await import("@/lib/env");
    expect(() =>
      parseEnv({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ai_newline",
        NEXTAUTH_SECRET: "a".repeat(32),
        NEXTAUTH_URL: "https://app.example.com",
        NODE_ENV: "production",
      }),
    ).toThrow(/CRAWLER_API_URL 在生产环境必填/);
  });

  it("accepts optional cron expressions", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { parseEnv } = await import("@/lib/env");
    const result = parseEnv({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ai_newline",
      NEXTAUTH_SECRET: "a".repeat(32),
      NODE_ENV: "development",
      ACCOUNT_SYNC_CRON: "0 */6 * * *",
      VIDEO_SYNC_CRON: "0 * * * *",
    });

    expect(result.ACCOUNT_SYNC_CRON).toBe("0 */6 * * *");
    expect(result.VIDEO_SYNC_CRON).toBe("0 * * * *");
  });

  it("accepts VIDEO_SNAPSHOT_CRON to configure snapshot collection", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { parseEnv } = await import("@/lib/env");
    const result = parseEnv({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ai_newline",
      NEXTAUTH_SECRET: "a".repeat(32),
      NODE_ENV: "development",
      VIDEO_SNAPSHOT_CRON: "*/10 * * * *",
    });

    expect(result.VIDEO_SNAPSHOT_CRON).toBe("*/10 * * * *");
  });

  it("accepts COLLECTION_SYNC_CRON to configure collection sync", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { parseEnv } = await import("@/lib/env");
    const result = parseEnv({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ai_newline",
      NEXTAUTH_SECRET: "a".repeat(32),
      NODE_ENV: "development",
      COLLECTION_SYNC_CRON: "*/5 * * * *",
    });

    expect(result.COLLECTION_SYNC_CRON).toBe("*/5 * * * *");
  });

  it("defaults TRANSCRIPTION_AI_MODEL and allows OPENAI_API_KEY to be omitted in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { parseEnv } = await import("@/lib/env");
    const result = parseEnv({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ai_newline",
      NEXTAUTH_SECRET: "a".repeat(32),
      NODE_ENV: "development",
    });

    expect(result.TRANSCRIPTION_AI_MODEL).toBe("openai/whisper-1");
    expect(result.OPENAI_API_KEY).toBeUndefined();
  });

  it("defaults douyin login runtime configuration", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { parseEnv } = await import("@/lib/env");
    const result = parseEnv({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ai_newline",
      NEXTAUTH_SECRET: "a".repeat(32),
      NODE_ENV: "development",
    });

    expect(result.DOUYIN_LOGIN_PAGE_URL).toBe("https://www.douyin.com/");
    expect(result.DOUYIN_LOGIN_OPEN_DEVTOOLS).toBe(false);
    expect(result.DOUYIN_LOGIN_TIMEOUT_MS).toBe(180000);
    expect(result.DOUYIN_LOGIN_STATE_DIR).toBeUndefined();
  });

  it("accepts Ark AI runtime configuration", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { parseEnv } = await import("@/lib/env");
    const result = parseEnv({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ai_newline",
      NEXTAUTH_SECRET: "a".repeat(32),
      NODE_ENV: "development",
      ARK_API_KEY: "ark_test_key",
      ARK_BASE_URL: "https://ark.example.com",
      ARK_TRANSCRIBE_MODEL: "ark/transcribe",
      ARK_DECOMPOSE_MODEL: "ark/decompose",
      ARK_REWRITE_MODEL: "ark/rewrite",
    });

    expect(result.ARK_API_KEY).toBe("ark_test_key");
    expect(result.ARK_BASE_URL).toBe("https://ark.example.com");
    expect(result.ARK_TRANSCRIBE_MODEL).toBe("ark/transcribe");
    expect(result.ARK_DECOMPOSE_MODEL).toBe("ark/decompose");
    expect(result.ARK_REWRITE_MODEL).toBe("ark/rewrite");
  });
});
