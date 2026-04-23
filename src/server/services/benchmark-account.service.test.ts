import { BenchmarkAccountMemberSource, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  archiveMock,
  createWithMemberMock,
  fetchUserProfileMock,
  findByIdMock,
  findByOrganizationAndProfileUrlIncludingDeletedMock,
  findByOrganizationAndSecUserIdIncludingDeletedMock,
  findMemberBenchmarkAccountIdsMock,
  findManyMock,
  findVideosByAccountIdMock,
  getSecUserIdMock,
  hasMemberMock,
  upsertMemberMock,
} = vi.hoisted(() => ({
  archiveMock: vi.fn(),
  createWithMemberMock: vi.fn(),
  fetchUserProfileMock: vi.fn(),
  findByIdMock: vi.fn(),
  findByOrganizationAndProfileUrlIncludingDeletedMock: vi.fn(),
  findByOrganizationAndSecUserIdIncludingDeletedMock: vi.fn(),
  findMemberBenchmarkAccountIdsMock: vi.fn(),
  findManyMock: vi.fn(),
  findVideosByAccountIdMock: vi.fn(),
  getSecUserIdMock: vi.fn(),
  hasMemberMock: vi.fn(),
  upsertMemberMock: vi.fn(),
}));

vi.mock("@/server/repositories/benchmark-account.repository", () => ({
  benchmarkAccountRepository: {
    archive: archiveMock,
    createWithMember: createWithMemberMock,
    findById: findByIdMock,
    findByOrganizationAndProfileUrlIncludingDeleted:
      findByOrganizationAndProfileUrlIncludingDeletedMock,
    findByOrganizationAndSecUserIdIncludingDeleted:
      findByOrganizationAndSecUserIdIncludingDeletedMock,
    findMemberBenchmarkAccountIds: findMemberBenchmarkAccountIdsMock,
    findMany: findManyMock,
    hasMember: hasMemberMock,
    upsertMember: upsertMemberMock,
  },
}));

vi.mock("@/server/repositories/benchmark-video.repository", () => ({
  benchmarkVideoRepository: {
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
    archiveMock.mockReset();
    createWithMemberMock.mockReset();
    fetchUserProfileMock.mockReset();
    findByIdMock.mockReset();
    findByOrganizationAndProfileUrlIncludingDeletedMock.mockReset();
    findByOrganizationAndSecUserIdIncludingDeletedMock.mockReset();
    findMemberBenchmarkAccountIdsMock.mockReset();
    findManyMock.mockReset();
    findVideosByAccountIdMock.mockReset();
    getSecUserIdMock.mockReset();
    hasMemberMock.mockReset();
    upsertMemberMock.mockReset();
  });

  it("reuses an existing active benchmark and adds the caller as a member", async () => {
    findByOrganizationAndSecUserIdIncludingDeletedMock.mockResolvedValue({
      id: "benchmark_1",
      profileUrl: "https://www.douyin.com/user/target",
      secUserId: "sec_target",
      deletedAt: null,
    });

    const { benchmarkAccountService } = await import("@/server/services/benchmark-account.service");
    const result = await benchmarkAccountService.createBenchmark(
      {
        id: "user_2",
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
    );

    expect(upsertMemberMock).toHaveBeenCalledWith({
      benchmarkAccountId: "benchmark_1",
      userId: "user_2",
      organizationId: "org_1",
      source: BenchmarkAccountMemberSource.MANUAL,
    });
    expect(createWithMemberMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: "benchmark_1",
      profileUrl: "https://www.douyin.com/user/target",
      secUserId: "sec_target",
    });
  });

  it("rejects creating a benchmark when the organization-scoped record is archived", async () => {
    findByOrganizationAndSecUserIdIncludingDeletedMock.mockResolvedValue({
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
    findManyMock.mockResolvedValue({
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
          createdByUserId: "user_1",
          organizationId: "org_1",
          createdAt: new Date("2026-04-03T00:00:00.000Z"),
          updatedAt: new Date("2026-04-03T00:00:00.000Z"),
          deletedAt: null,
          lastSyncedAt: null,
          createdByUser: {
            id: "user_1",
            name: "创建者",
          },
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    findMemberBenchmarkAccountIdsMock.mockResolvedValue(new Set(["benchmark_1"]));

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

    expect(findManyMock).toHaveBeenCalledWith({
      organizationId: "org_1",
      archiveFilter: "active",
      page: 1,
      limit: 20,
    });
    expect(result.items[0]).toMatchObject({
      id: "benchmark_1",
      creatorName: "创建者",
      canArchive: true,
    });
  });

  it("allows any associated member to archive the benchmark", async () => {
    findByIdMock.mockResolvedValue({
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
      createdByUserId: "user_1",
      organizationId: "org_1",
      createdAt: new Date("2026-04-03T00:00:00.000Z"),
      updatedAt: new Date("2026-04-03T00:00:00.000Z"),
      deletedAt: null,
      lastSyncedAt: null,
      createdByUser: {
        id: "user_1",
        name: "创建者",
      },
    });
    hasMemberMock.mockResolvedValue(true);
    archiveMock.mockResolvedValue({
      id: "benchmark_1",
      deletedAt: new Date("2026-04-05T00:00:00.000Z"),
    });

    const { benchmarkAccountService } = await import("@/server/services/benchmark-account.service");
    const result = await benchmarkAccountService.archiveBenchmark(
      {
        id: "user_2",
        account: "employee",
        name: "员工 2",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
      "benchmark_1",
    );

    expect(hasMemberMock).toHaveBeenCalledWith("benchmark_1", "user_2");
    expect(result).toEqual({
      id: "benchmark_1",
      deletedAt: "2026-04-05T00:00:00.000Z",
    });
  });
});
