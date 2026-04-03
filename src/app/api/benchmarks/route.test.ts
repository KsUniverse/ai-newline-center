import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, createBenchmarkMock, listBenchmarksMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  createBenchmarkMock: vi.fn(),
  listBenchmarksMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/benchmark-account.service", () => ({
  benchmarkAccountService: {
    createBenchmark: createBenchmarkMock,
    listBenchmarks: listBenchmarksMock,
  },
}));

describe("/api/benchmarks", () => {
  beforeEach(() => {
    authMock.mockReset();
    createBenchmarkMock.mockReset();
    listBenchmarksMock.mockReset();
  });

  it("returns benchmark list data for authenticated users", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    listBenchmarksMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    const { GET } = await import("@/app/api/benchmarks/route");
    const response = await GET(new Request("http://localhost/api/benchmarks?page=1&limit=20"));

    expect(response.status).toBe(200);
    expect(listBenchmarksMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user_1" }),
      { page: 1, limit: 20 },
    );
  });

  it("creates a benchmark through the benchmark service", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    createBenchmarkMock.mockResolvedValue({
      id: "benchmark_1",
      secUserId: "sec_target",
    });

    const { POST } = await import("@/app/api/benchmarks/route");
    const response = await POST(
      new Request("http://localhost/api/benchmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createBenchmarkMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user_1" }),
      expect.objectContaining({ secUserId: "sec_target" }),
    );
  });
});
