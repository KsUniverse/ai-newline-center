import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, createAccountMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  createAccountMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/douyin-account.service", () => ({
  douyinAccountService: {
    createAccount: createAccountMock,
  },
}));

describe("POST /api/douyin-accounts", () => {
  beforeEach(() => {
    authMock.mockReset();
    createAccountMock.mockReset();
  });

  it("passes secUserId through to the service", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    createAccountMock.mockResolvedValue({
      id: "account_1",
      secUserId: "sec_123",
    });

    const { POST } = await import("@/app/api/douyin-accounts/route");
    const response = await POST(
      new Request("http://localhost/api/douyin-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileUrl: "https://www.douyin.com/user/tester",
          secUserId: "sec_123",
          nickname: "测试账号",
          avatar: "https://cdn.example.com/avatar.jpg",
          bio: null,
          signature: "十年磨一剑，逆风翻盘。",
          followersCount: 10,
          followingCount: 20,
          likesCount: 300,
          videosCount: 2,
          douyinNumber: "49001906753",
          ipLocation: "IP属地：湖北",
          age: 36,
          province: "湖北",
          city: "武汉",
          verificationLabel: "慧研智投科技有限公司一般证券从业人员",
          verificationIconUrl: "https://lf3-static.bytednsdoc.com/yellow-v.png",
          verificationType: 0,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user_1" }),
      expect.objectContaining({ secUserId: "sec_123" }),
    );
  });
});
