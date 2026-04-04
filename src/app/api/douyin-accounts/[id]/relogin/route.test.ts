import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, reloginMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  reloginMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/douyin-auth.service", () => ({
  douyinAuthService: {
    relogin: reloginMock,
  },
}));

describe("POST /api/douyin-accounts/[id]/relogin", () => {
  beforeEach(() => {
    authMock.mockReset();
    reloginMock.mockReset();
  });

  it("returns 403 when a non-employee tries to relogin an account", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "manager_1",
        role: UserRole.BRANCH_MANAGER,
        organizationId: "org_1",
      },
    });

    const { POST } = await import("@/app/api/douyin-accounts/[id]/relogin/route");
    const response = await POST(new Request("http://localhost/api/douyin-accounts/ck123/relogin"), {
      params: Promise.resolve({ id: "cm8v0h7i50000v1a0abc12345" }),
    });

    expect(response.status).toBe(403);
  });

  it("delegates relogin to the auth service for employees", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    reloginMock.mockResolvedValue({
      id: "cm9login00001abc123456789",
      purpose: "RELOGIN",
      status: "QRCODE_READY",
      qrcodeDataUrl: "data:image/png;base64,abc",
      expiresAt: "2026-04-04T08:00:00.000Z",
      resolvedSecUserId: null,
      accountId: "cm8v0h7i50000v1a0abc12345",
      errorCode: null,
      errorMessage: null,
      message: "请使用抖音 App 扫码登录",
    });

    const { POST } = await import("@/app/api/douyin-accounts/[id]/relogin/route");
    const response = await POST(new Request("http://localhost/api/douyin-accounts/ck123/relogin"), {
      params: Promise.resolve({ id: "cm8v0h7i50000v1a0abc12345" }),
    });

    expect(response.status).toBe(201);
    expect(reloginMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user_1", organizationId: "org_1" }),
      "cm8v0h7i50000v1a0abc12345",
    );
  });
});