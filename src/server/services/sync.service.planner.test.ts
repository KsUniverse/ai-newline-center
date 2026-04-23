import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  addJobMock,
  benchmarkFindAllMock,
  ensureProfilesMock,
  findDueProfilesMock,
  findAllAccountsMock,
  findNearestScheduledProfileMock,
} = vi.hoisted(() => ({
  addJobMock: vi.fn(),
  benchmarkFindAllMock: vi.fn(),
  ensureProfilesMock: vi.fn(),
  findDueProfilesMock: vi.fn(),
  findAllAccountsMock: vi.fn(),
  findNearestScheduledProfileMock: vi.fn(),
}));

vi.mock("@/lib/bullmq", () => ({
  CRAWLER_VIDEO_SYNC_QUEUE_NAME: "crawler-video-sync",
  getCrawlerVideoSyncQueue: () => ({
    add: addJobMock,
  }),
}));

vi.mock("@/server/repositories/account-video-sync-profile.repository", () => ({
  accountVideoSyncProfileRepository: {
    ensureProfiles: ensureProfilesMock,
    findDueProfiles: findDueProfilesMock,
    findNearestScheduledProfile: findNearestScheduledProfileMock,
  },
}));

vi.mock("@/server/repositories/douyin-account.repository", () => ({
  douyinAccountRepository: {
    findAll: findAllAccountsMock,
    findById: vi.fn(),
    findFirstActiveShareCookie: vi.fn().mockResolvedValue(null),
    findAllMyAccountsForCollection: vi.fn().mockResolvedValue([]),
    markLoginExpired: vi.fn(),
    updateAccountInfo: vi.fn(),
    updateSecUserId: vi.fn(),
  },
}));

vi.mock("@/server/repositories/benchmark-account.repository", () => ({
  benchmarkAccountRepository: {
    createWithMember: vi.fn(),
    findAll: benchmarkFindAllMock,
    findByOrganizationAndSecUserIdIncludingDeleted: vi.fn(),
    updateAccountInfo: vi.fn(),
    updateSecUserId: vi.fn(),
    upsertMember: vi.fn(),
  },
}));

vi.mock("@/server/repositories/douyin-video.repository", () => ({
  douyinVideoRepository: {
    countByAccountId: vi.fn().mockResolvedValue(0),
    findAllActiveForSnapshotSync: vi.fn().mockResolvedValue([]),
    findByVideoId: vi.fn().mockResolvedValue(null),
    updateStats: vi.fn(),
    updateStatsByVideoId: vi.fn(),
    upsertByVideoId: vi.fn(),
  },
}));

vi.mock("@/server/repositories/benchmark-video.repository", () => ({
  benchmarkVideoRepository: {
    countByAccountId: vi.fn().mockResolvedValue(0),
    findAllActiveForSnapshotSync: vi.fn().mockResolvedValue([]),
    findByAccountAndVideoId: vi.fn().mockResolvedValue(null),
    updateStats: vi.fn(),
    updateStatsByAccountVideoId: vi.fn(),
    upsertByVideoId: vi.fn(),
  },
}));

vi.mock("@/server/repositories/video-snapshot.repository", () => ({
  videoSnapshotRepository: {
    create: vi.fn(),
  },
}));

vi.mock("@/server/repositories/benchmark-video-snapshot.repository", () => ({
  benchmarkVideoSnapshotRepository: {
    create: vi.fn(),
  },
}));

vi.mock("@/server/repositories/employee-collection-video.repository", () => ({
  employeeCollectionVideoRepository: {
    create: vi.fn(),
    existsByAccountAndAwemeId: vi.fn().mockResolvedValue(false),
    existsForAccount: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock("@/server/services/crawler.service", () => ({
  crawlerService: {
    fetchCollectionVideos: vi.fn(),
    fetchOneVideo: vi.fn(),
    fetchUserProfile: vi.fn(),
    fetchVideoList: vi.fn(),
    getSecUserId: vi.fn(),
  },
}));

vi.mock("@/server/services/storage.service", () => ({
  storageService: {
    downloadAndStore: vi.fn(),
  },
}));

describe("syncService.runVideoSyncPlanner", () => {
  const myAccountDueAt = new Date("2026-04-23T16:20:00.000Z");
  const benchmarkDueAt = new Date("2026-04-23T16:25:00.000Z");

  beforeEach(() => {
    addJobMock.mockReset();
    benchmarkFindAllMock.mockReset();
    ensureProfilesMock.mockReset();
    findDueProfilesMock.mockReset();
    findAllAccountsMock.mockReset();
    findNearestScheduledProfileMock.mockReset();
    addJobMock.mockResolvedValue(undefined);
    benchmarkFindAllMock.mockResolvedValue([
      {
        id: "benchmark_1",
        organizationId: "org_1",
        profileUrl: "https://www.douyin.com/user/benchmark",
        secUserId: "sec_benchmark_1",
        bannedAt: null,
      },
    ]);
    findAllAccountsMock.mockResolvedValue([
      {
        id: "account_1",
        organizationId: "org_1",
        profileUrl: "https://www.douyin.com/user/account",
        secUserId: "sec_account_1",
      },
    ]);
    ensureProfilesMock.mockResolvedValue(undefined);
    findDueProfilesMock.mockResolvedValue([
      {
        accountType: "MY_ACCOUNT",
        accountId: "account_1",
        organizationId: "org_1",
        nextSyncAt: myAccountDueAt,
      },
      {
        accountType: "BENCHMARK_ACCOUNT",
        accountId: "benchmark_1",
        organizationId: "org_1",
        nextSyncAt: benchmarkDueAt,
      },
    ]);
    findNearestScheduledProfileMock.mockResolvedValue({
      nextSyncAt: myAccountDueAt,
    });
  });

  it("enqueues due account sync jobs with per-sync-window dedupe job ids", async () => {
    const { syncService } = await import("@/server/services/sync.service");

    await syncService.runVideoSyncPlanner();

    expect(ensureProfilesMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          accountType: "MY_ACCOUNT",
          accountId: "account_1",
          organizationId: "org_1",
        }),
        expect.objectContaining({
          accountType: "BENCHMARK_ACCOUNT",
          accountId: "benchmark_1",
          organizationId: "org_1",
        }),
      ]),
    );
    expect(addJobMock).toHaveBeenNthCalledWith(
      1,
      "crawler-video-sync",
      {
        accountType: "MY_ACCOUNT",
        accountId: "account_1",
        organizationId: "org_1",
      },
      {
        jobId: `crawler-video-sync__MY_ACCOUNT__account_1__${myAccountDueAt.getTime()}`,
      },
    );
    expect(addJobMock).toHaveBeenNthCalledWith(
      2,
      "crawler-video-sync",
      {
        accountType: "BENCHMARK_ACCOUNT",
        accountId: "benchmark_1",
        organizationId: "org_1",
      },
      {
        jobId: `crawler-video-sync__BENCHMARK_ACCOUNT__benchmark_1__${benchmarkDueAt.getTime()}`,
      },
    );
  });
});
