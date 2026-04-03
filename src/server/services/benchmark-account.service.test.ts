import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createBenchmarkMock,
  fetchUserProfileMock,
  findBenchmarkByIdMock,
  findByProfileUrlMock,
  findBySecUserIdIncludingDeletedMock,
  findManyBenchmarksMock,
  findVideosByAccountIdMock,
  getSecUserIdMock,
} = vi.hoisted(() => ({
  createBenchmarkMock: vi.fn(),
  fetchUserProfileMock: vi.fn(),
  findBenchmarkByIdMock: vi.fn(),
  findByProfileUrlMock: vi.fn(),
  findBySecUserIdIncludingDeletedMock: vi.fn(),
  findManyBenchmarksMock: vi.fn(),
  findVideosByAccountIdMock: vi.fn(),
  getSecUserIdMock: vi.fn(),
}));

vi.mock("@/server/repositories/douyin-account.repository", () => ({
  douyinAccountRepository: {
    createBenchmark: createBenchmarkMock,
    findBenchmarkById: findBenchmarkByIdMock,
    findByProfileUrl: findByProfileUrlMock,
    findBySecUserIdIncludingDeleted: findBySecUserIdIncludingDeletedMock,
    findManyBenchmarks: findManyBenchmarksMock,
  },
}));

vi.mock("@/server/repositories/douyin-video.repository", () => ({
  douyinVideoRepository: {
    findByAccountId: findVideosByAccountIdMock,
  },
}));

vi.mock("@/server/services/crawler.service", () => ({
  crawlerService: {
    fetchUserProfile: fetchUserProfileMock,
    getSecUserId: getSecUserIdMock,
  },
}));

describe("benchmarkAccountService", () => {
  beforeEach(() => {
    createBenchmarkMock.mockReset();
    fetchUserProfileMock.mockReset();
    findBenchmarkByIdMock.mockReset();
    findByProfileUrlMock.mockReset();
    findBySecUserIdIncludingDeletedMock.mockReset();
    findManyBenchmarksMock.mockReset();
    findVideosByAccountIdMock.mockReset();
    getSecUserIdMock.mockReset();
  });

  it("rejects creating a benchmark when the secUserId already exists in archived state", async () => {
    findBySecUserIdIncludingDeletedMock.mockResolvedValue({
      id: "benchmark_1",
      deletedAt: new Date("2026-04-03T00:00:00.000Z"),
    });

    const { benchmarkAccountService } = await import("@/server/services/benchmark-account.service");

    await expect(
      benchmarkAccountService.createBenchmark(
        {
          id: "user_1",
          account: "employee",
          name: "员工",
          role: UserRole.EMPLOYEE,
          organizationId: "org_1",
        },
        {
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
        },
      ),
    ).rejects.toMatchObject({
      code: "BENCHMARK_ARCHIVED",
      statusCode: 409,
    });
  });

  it("lists active benchmarks by organization and maps creatorName", async () => {
    findManyBenchmarksMock.mockResolvedValue({
      items: [
        {
          id: "benchmark_1",
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
          type: "BENCHMARK_ACCOUNT",
          userId: "user_1",
          organizationId: "org_1",
          createdAt: new Date("2026-04-03T00:00:00.000Z"),
          updatedAt: new Date("2026-04-03T00:00:00.000Z"),
          deletedAt: null,
          lastSyncedAt: null,
          user: {
            id: "user_1",
            name: "创建者",
          },
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });

    const { benchmarkAccountService } = await import("@/server/services/benchmark-account.service");
    const result = await benchmarkAccountService.listBenchmarks(
      {
        id: "user_2",
        account: "employee",
        name: "员工",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
      { page: 1, limit: 20 },
    );

    expect(findManyBenchmarksMock).toHaveBeenCalledWith({
      organizationId: "org_1",
      includeArchived: false,
      page: 1,
      limit: 20,
    });
    expect(result.items[0]).toMatchObject({
      id: "benchmark_1",
      creatorName: "创建者",
    });
  });
});
