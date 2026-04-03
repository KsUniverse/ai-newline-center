import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, previewAccountMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  previewAccountMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/douyin-account.service", () => ({
  douyinAccountService: {
    previewAccount: previewAccountMock,
  },
}));

describe("POST /api/douyin-accounts/preview", () => {
  beforeEach(() => {
    authMock.mockReset();
    previewAccountMock.mockReset();
  });

  it("returns preview data including secUserId", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    previewAccountMock.mockResolvedValue({
      profileUrl: "https://www.douyin.com/user/tester",
      secUserId: "sec_123",
      nickname: "测试账号",
      avatar: "https://cdn.example.com/avatar.jpg",
      bio: null,
      followersCount: 10,
      videosCount: 2,
    });

    const { POST } = await import("@/app/api/douyin-accounts/preview/route");
    const response = await POST(
      new Request("http://localhost/api/douyin-accounts/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileUrl: "https://www.douyin.com/user/tester",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        profileUrl: "https://www.douyin.com/user/tester",
        secUserId: "sec_123",
        nickname: "测试账号",
        avatar: "https://cdn.example.com/avatar.jpg",
        bio: null,
        followersCount: 10,
        videosCount: 2,
      },
    });
  });
});
