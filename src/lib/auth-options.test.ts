import { describe, expect, it } from "vitest";

import { resolveAuthTrustHost } from "@/lib/auth-options";

describe("resolveAuthTrustHost", () => {
  it("trusts host in production when NEXTAUTH_URL is configured", () => {
    expect(
      resolveAuthTrustHost({
        NODE_ENV: "production",
        NEXTAUTH_URL: "https://app.example.com",
      }),
    ).toBe(true);
  });

  it("respects explicit AUTH_TRUST_HOST overrides", () => {
    expect(
      resolveAuthTrustHost({
        NODE_ENV: "production",
        NEXTAUTH_URL: "https://app.example.com",
        AUTH_TRUST_HOST: false,
      }),
    ).toBe(false);
  });

  it("trusts host by default outside production", () => {
    expect(
      resolveAuthTrustHost({
        NODE_ENV: "development",
      }),
    ).toBe(true);
  });
});
