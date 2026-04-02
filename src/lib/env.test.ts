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

    const { parseEnv } = await import("@/lib/env");
    expect(() =>
      parseEnv({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ai_newline",
        NEXTAUTH_SECRET: "a".repeat(32),
        NODE_ENV: "production",
      }),
    ).toThrow(/生产环境必填/);
  });
});
