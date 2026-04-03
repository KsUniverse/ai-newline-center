import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, previewBenchmarkMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  previewBenchmarkMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/benchmark-account.service", () => ({
  benchmarkAccountService: {
    previewBenchmark: previewBenchmarkMock,
  },
}));

describe("POST /api/benchmarks/preview", () => {
  beforeEach(() => {
    authMock.mockReset();
    previewBenchmarkMock.mockReset();
  });

  it("returns benchmark preview data", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    previewBenchmarkMock.mockResolvedValue({
      profileUrl: "https://www.douyin.com/user/target",
      secUserId: "sec_target",
      nickname: "对标账号",
      avatar: "https://cdn.example.com/avatar.jpg",
      bio: null,
      signature: null,
      followersCount: 10,
      followingCount: 1,
      likesCount: 20,
      videosCount: 2,
      douyinNumber: null,
      ipLocation: null,
      age: null,
      province: null,
      city: null,
      verificationLabel: null,
      verificationIconUrl: null,
      verificationType: null,
    });

    const { POST } = await import("@/app/api/benchmarks/preview/route");
    const response = await POST(
      new Request("http://localhost/api/benchmarks/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileUrl: "https://www.douyin.com/user/target",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: expect.objectContaining({
        secUserId: "sec_target",
      }),
    });
  });
});
