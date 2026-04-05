import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { authMock, getSessionMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/douyin-auth.service", () => ({
  douyinAuthService: {
    getSession: getSessionMock,
  },
}));

describe("GET /api/douyin-account-login-sessions/[id]/sse", () => {
  beforeEach(() => {
    authMock.mockReset();
    getSessionMock.mockReset();
  });

  it("emits session-error for failed terminal sessions", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    getSessionMock.mockResolvedValue({
      id: "cm9login00001abc123456789",
      purpose: "RELOGIN",
      status: "FAILED",
      currentStep: "FAILED",
      qrcodeDataUrl: null,
      expiresAt: null,
      resolvedSecUserId: null,
      accountId: "account_1",
      errorCode: "LOGIN_SESSION_FAILED",
      errorMessage: "登录失败",
      message: "登录失败",
    });

    const { GET } = await import(
      "@/app/api/douyin-account-login-sessions/[id]/sse/route"
    );

    const response = await GET(
      new Request(
        "http://localhost/api/douyin-account-login-sessions/cm9login00001abc123456789/sse",
      ) as NextRequest,
      { params: Promise.resolve({ id: "cm9login00001abc123456789" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("event: session-error");
    expect(body).not.toContain("event: error");
  });
});
