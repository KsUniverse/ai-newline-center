import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, createSessionMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  createSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/douyin-auth.service", () => ({
  douyinAuthService: {
    createSession: createSessionMock,
  },
}));

describe("POST /api/douyin-account-login-sessions", () => {
  beforeEach(() => {
    authMock.mockReset();
    createSessionMock.mockReset();
  });

  it("returns 401 when the user is not logged in", async () => {
    authMock.mockResolvedValue(null);

    const { POST } = await import("@/app/api/douyin-account-login-sessions/route");
    const response = await POST(
      new Request("http://localhost/api/douyin-account-login-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purpose: "CREATE_ACCOUNT" }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("creates a login session for employees", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    createSessionMock.mockResolvedValue({
      id: "cm9login00001abc123456789",
      purpose: "CREATE_ACCOUNT",
      status: "QRCODE_READY",
      qrcodeDataUrl: "data:image/png;base64,abc",
      expiresAt: "2026-04-04T08:00:00.000Z",
      resolvedSecUserId: null,
      accountId: null,
      errorCode: null,
      errorMessage: null,
      message: "请使用抖音 App 扫码登录",
    });

    const { POST } = await import("@/app/api/douyin-account-login-sessions/route");
    const response = await POST(
      new Request("http://localhost/api/douyin-account-login-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purpose: "CREATE_ACCOUNT" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user_1", organizationId: "org_1" }),
      { purpose: "CREATE_ACCOUNT" },
    );
  });
});