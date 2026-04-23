import {
  BenchmarkAccountMemberSource,
  DouyinAccountLoginStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findDueProfilesMock,
  findNearestScheduledProfileMock,
  addCrawlerVideoSyncJobMock,
  benchmarkCreateWithMemberMock,
  benchmarkFindAllMock,
  benchmarkFindByOrgSecUserIdMock,
  benchmarkFindVideoByAccountAndVideoIdMock,
  benchmarkSnapshotCreateMock,
  benchmarkUpdateAccountInfoMock,
  benchmarkUpdateSecUserIdMock,
  benchmarkUpdateStatsByAccountVideoIdMock,
  benchmarkUpdateStatsMock,
  benchmarkUpsertMemberMock,
  benchmarkUpsertVideoMock,
  collectionCreateMock,
  collectionExistsByAwemeIdMock,
  collectionExistsForAccountMock,
  countByAccountIdMock,
  douyinFindAccountByIdMock,
  downloadAndStoreMock,
  fetchCollectionVideosMock,
  fetchOneVideoMock,
  fetchUserProfileMock,
  fetchVideoListMock,
  findProfileByAccountMock,
  findFirstActiveShareCookieMock,
  findAllActiveVideosForSnapshotSyncMock,
  findAllAccountsMock,
  findAllMyAccountsForCollectionMock,
  findByVideoIdMock,
  findRecentBenchmarkPublishedAtMock,
  findRecentPublishedAtMock,
  getSecUserIdMock,
  markLoginExpiredMock,
  upsertProfileStateMock,
  updateAccountInfoMock,
  updateSecUserIdMock,
  updateStatsMock,
  upsertVideoMock,
  videoSnapshotCreateMock,
} = vi.hoisted(() => ({
  findDueProfilesMock: vi.fn(),
  findNearestScheduledProfileMock: vi.fn(),
  addCrawlerVideoSyncJobMock: vi.fn(),
  benchmarkCreateWithMemberMock: vi.fn(),
  benchmarkFindAllMock: vi.fn(),
  benchmarkFindByOrgSecUserIdMock: vi.fn(),
  benchmarkFindVideoByAccountAndVideoIdMock: vi.fn(),
  benchmarkSnapshotCreateMock: vi.fn(),
  benchmarkUpdateAccountInfoMock: vi.fn(),
  benchmarkUpdateSecUserIdMock: vi.fn(),
  benchmarkUpdateStatsByAccountVideoIdMock: vi.fn(),
  benchmarkUpdateStatsMock: vi.fn(),
  benchmarkUpsertMemberMock: vi.fn(),
  benchmarkUpsertVideoMock: vi.fn(),
  collectionCreateMock: vi.fn(),
  collectionExistsByAwemeIdMock: vi.fn(),
  collectionExistsForAccountMock: vi.fn(),
  countByAccountIdMock: vi.fn(),
  douyinFindAccountByIdMock: vi.fn(),
  downloadAndStoreMock: vi.fn(),
  fetchCollectionVideosMock: vi.fn(),
  fetchOneVideoMock: vi.fn(),
  fetchUserProfileMock: vi.fn(),
  fetchVideoListMock: vi.fn(),
  findProfileByAccountMock: vi.fn(),
  findFirstActiveShareCookieMock: vi.fn(),
  findAllActiveVideosForSnapshotSyncMock: vi.fn(),
  findAllAccountsMock: vi.fn(),
  findAllMyAccountsForCollectionMock: vi.fn(),
  findByVideoIdMock: vi.fn(),
  findRecentBenchmarkPublishedAtMock: vi.fn(),
  findRecentPublishedAtMock: vi.fn(),
  getSecUserIdMock: vi.fn(),
  markLoginExpiredMock: vi.fn(),
  upsertProfileStateMock: vi.fn(),
  updateAccountInfoMock: vi.fn(),
  updateSecUserIdMock: vi.fn(),
  updateStatsMock: vi.fn(),
  upsertVideoMock: vi.fn(),
  videoSnapshotCreateMock: vi.fn(),
}));

vi.mock("@/lib/bullmq", () => ({
  CRAWLER_VIDEO_SYNC_QUEUE_NAME: "crawler-video-sync",
  getCrawlerVideoSyncQueue: () => ({
    add: addCrawlerVideoSyncJobMock,
  }),
}));

vi.mock("@/server/services/crawler.service", () => ({
  crawlerService: {
    fetchCollectionVideos: fetchCollectionVideosMock,
    fetchOneVideo: fetchOneVideoMock,
    fetchUserProfile: fetchUserProfileMock,
    fetchVideoList: fetchVideoListMock,
    getSecUserId: getSecUserIdMock,
  },
}));

vi.mock("@/server/repositories/douyin-account.repository", () => ({
  douyinAccountRepository: {
    findAll: findAllAccountsMock,
    findFirstActiveShareCookie: findFirstActiveShareCookieMock,
    findAllMyAccountsForCollection: findAllMyAccountsForCollectionMock,
    findById: douyinFindAccountByIdMock,
    markLoginExpired: markLoginExpiredMock,
    updateAccountInfo: updateAccountInfoMock,
    updateSecUserId: updateSecUserIdMock,
  },
}));

vi.mock("@/server/repositories/benchmark-account.repository", () => ({
  benchmarkAccountRepository: {
    createWithMember: benchmarkCreateWithMemberMock,
    findAll: benchmarkFindAllMock,
    findByOrganizationAndSecUserIdIncludingDeleted: benchmarkFindByOrgSecUserIdMock,
    updateAccountInfo: benchmarkUpdateAccountInfoMock,
    updateSecUserId: benchmarkUpdateSecUserIdMock,
    upsertMember: benchmarkUpsertMemberMock,
  },
}));

vi.mock("@/server/repositories/employee-collection-video.repository", () => ({
  employeeCollectionVideoRepository: {
    create: collectionCreateMock,
    existsByAccountAndAwemeId: collectionExistsByAwemeIdMock,
    existsForAccount: collectionExistsForAccountMock,
  },
}));

vi.mock("@/server/repositories/douyin-video.repository", () => ({
  douyinVideoRepository: {
    countByAccountId: countByAccountIdMock,
    findAllActiveForSnapshotSync: findAllActiveVideosForSnapshotSyncMock,
    findByVideoId: findByVideoIdMock,
    findRecentPublishedAtByAccountId: findRecentPublishedAtMock,
    updateStats: updateStatsMock,
    updateStatsByVideoId: updateStatsMock,
    upsertByVideoId: upsertVideoMock,
  },
}));

vi.mock("@/server/repositories/benchmark-video.repository", () => ({
  benchmarkVideoRepository: {
    countByAccountId: countByAccountIdMock,
    findAllActiveForSnapshotSync: vi.fn().mockResolvedValue([]),
    findByAccountAndVideoId: benchmarkFindVideoByAccountAndVideoIdMock,
    findRecentPublishedAtByAccountId: findRecentBenchmarkPublishedAtMock,
    updateStats: benchmarkUpdateStatsMock,
    updateStatsByAccountVideoId: benchmarkUpdateStatsByAccountVideoIdMock,
    upsertByVideoId: benchmarkUpsertVideoMock,
  },
}));

vi.mock("@/server/repositories/account-video-sync-profile.repository", () => ({
  accountVideoSyncProfileRepository: {
    ensureProfiles: vi.fn(),
    findByAccount: findProfileByAccountMock,
    findDueProfiles: findDueProfilesMock,
    findNearestScheduledProfile: findNearestScheduledProfileMock,
    upsertState: upsertProfileStateMock,
  },
}));

vi.mock("@/server/repositories/video-snapshot.repository", () => ({
  videoSnapshotRepository: {
    create: videoSnapshotCreateMock,
  },
}));

vi.mock("@/server/repositories/benchmark-video-snapshot.repository", () => ({
  benchmarkVideoSnapshotRepository: {
    create: benchmarkSnapshotCreateMock,
  },
}));

vi.mock("@/server/services/storage.service", () => ({
  storageService: {
    downloadAndStore: downloadAndStoreMock,
  },
}));

describe("syncService", () => {
  beforeEach(() => {
    addCrawlerVideoSyncJobMock.mockReset();
    benchmarkCreateWithMemberMock.mockReset();
    benchmarkFindAllMock.mockReset();
    benchmarkFindByOrgSecUserIdMock.mockReset();
    benchmarkFindVideoByAccountAndVideoIdMock.mockReset();
    benchmarkSnapshotCreateMock.mockReset();
    benchmarkUpdateAccountInfoMock.mockReset();
    benchmarkUpdateSecUserIdMock.mockReset();
    benchmarkUpdateStatsByAccountVideoIdMock.mockReset();
    benchmarkUpdateStatsMock.mockReset();
    benchmarkUpsertMemberMock.mockReset();
    benchmarkUpsertVideoMock.mockReset();
    collectionCreateMock.mockReset();
    collectionExistsByAwemeIdMock.mockReset();
    collectionExistsForAccountMock.mockReset();
    countByAccountIdMock.mockReset();
    douyinFindAccountByIdMock.mockReset();
    downloadAndStoreMock.mockReset();
    fetchCollectionVideosMock.mockReset();
    fetchOneVideoMock.mockReset();
    fetchUserProfileMock.mockReset();
    fetchVideoListMock.mockReset();
    findDueProfilesMock.mockReset();
    findNearestScheduledProfileMock.mockReset();
    findProfileByAccountMock.mockReset();
    findFirstActiveShareCookieMock.mockReset();
    findAllActiveVideosForSnapshotSyncMock.mockReset();
    findAllAccountsMock.mockReset();
    findAllMyAccountsForCollectionMock.mockReset();
    findByVideoIdMock.mockReset();
    findRecentBenchmarkPublishedAtMock.mockReset();
    findRecentPublishedAtMock.mockReset();
    getSecUserIdMock.mockReset();
    markLoginExpiredMock.mockReset();
    upsertProfileStateMock.mockReset();
    updateAccountInfoMock.mockReset();
    updateSecUserIdMock.mockReset();
    updateStatsMock.mockReset();
    upsertVideoMock.mockReset();
    videoSnapshotCreateMock.mockReset();

    benchmarkFindAllMock.mockResolvedValue([]);
    addCrawlerVideoSyncJobMock.mockResolvedValue(undefined);
    collectionCreateMock.mockResolvedValue(undefined);
    collectionExistsByAwemeIdMock.mockResolvedValue(false);
    collectionExistsForAccountMock.mockResolvedValue(false);
    countByAccountIdMock.mockResolvedValue(0);
    downloadAndStoreMock.mockResolvedValue(null);
    findAllActiveVideosForSnapshotSyncMock.mockResolvedValue([]);
    findAllAccountsMock.mockResolvedValue([]);
    findDueProfilesMock.mockResolvedValue([]);
    findNearestScheduledProfileMock.mockResolvedValue(null);
    findFirstActiveShareCookieMock.mockResolvedValue(null);
    findByVideoIdMock.mockResolvedValue(null);
    findProfileByAccountMock.mockResolvedValue(null);
    findRecentBenchmarkPublishedAtMock.mockResolvedValue([]);
    findRecentPublishedAtMock.mockResolvedValue([]);
    upsertProfileStateMock.mockResolvedValue(undefined);
    updateAccountInfoMock.mockResolvedValue({
      id: "account_1",
      lastSyncedAt: new Date("2026-04-03T00:00:00.000Z"),
    });
    benchmarkUpdateAccountInfoMock.mockResolvedValue({
      id: "benchmark_1",
      lastSyncedAt: new Date("2026-04-03T00:00:00.000Z"),
    });
    updateSecUserIdMock.mockResolvedValue({ id: "account_1", secUserId: "sec_123" });
    upsertVideoMock.mockResolvedValue(undefined);
  });

  it("backfills secUserId and syncs account info for the caller's own account", async () => {
    douyinFindAccountByIdMock.mockResolvedValue({
      id: "account_1",
      userId: "user_1",
      organizationId: "org_1",
      profileUrl: "https://www.douyin.com/user/tester",
      secUserId: null,
    });
    getSecUserIdMock.mockResolvedValue("sec_123");
    fetchUserProfileMock.mockResolvedValue({
      secUserId: "sec_123",
      nickname: "测试账号",
      avatar: "https://cdn.example.com/avatar.jpg",
      bio: null,
      signature: "简介",
      followersCount: 100,
      followingCount: 20,
      likesCount: 300,
      videosCount: 5,
      douyinNumber: "49001906753",
      ipLocation: "IP属地：湖北",
      age: 36,
      province: "湖北",
      city: "武汉",
      verificationLabel: "认证信息",
      verificationIconUrl: "https://cdn.example.com/badge.png",
      verificationType: 0,
    });
    fetchVideoListMock.mockResolvedValue({
      videos: [
        {
          awemeId: "video_1",
          title: "视频 1",
          shareUrl: "https://www.iesdouyin.com/share/video/1",
          coverSourceUrl: "https://cdn.example.com/cover-a.gif",
          videoSourceUrl: "https://cdn.example.com/video-a.mp4",
          publishedAt: "2026-04-03T00:00:00.000Z",
          playCount: 10,
          likeCount: 2,
          commentCount: 1,
          shareCount: 0,
          collectCount: 4,
          admireCount: 5,
          recommendCount: 6,
        },
      ],
      hasMore: false,
      cursor: 0,
    });
    downloadAndStoreMock
      .mockResolvedValueOnce("/storage/covers/2026-04-03/cover.gif")
      .mockResolvedValueOnce("/storage/videos/2026-04-03/video.mp4");

    const { syncService } = await import("@/server/services/sync.service");
    const result = await syncService.syncAccount("account_1", "user_1", "org_1");

    expect(updateSecUserIdMock).toHaveBeenCalledWith("account_1", "sec_123");
    expect(fetchVideoListMock).toHaveBeenCalledWith("sec_123", 0, 10, undefined);
    expect(updateAccountInfoMock).toHaveBeenCalledWith(
      "account_1",
      expect.objectContaining({
        nickname: "测试账号",
        signature: "简介",
        followingCount: 20,
        likesCount: 300,
        douyinNumber: "49001906753",
        ipLocation: "IP属地：湖北",
        age: 36,
        province: "湖北",
        city: "武汉",
        verificationLabel: "认证信息",
        verificationIconUrl: "https://cdn.example.com/badge.png",
        verificationType: 0,
        lastSyncedAt: expect.any(Date),
      }),
    );
    expect(upsertVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "account_1",
        videoId: "video_1",
        shareUrl: "https://www.iesdouyin.com/share/video/1",
        coverSourceUrl: "https://cdn.example.com/cover-a.gif",
        coverStoragePath: "/storage/covers/2026-04-03/cover.gif",
        coverUrl: "/storage/covers/2026-04-03/cover.gif",
        videoSourceUrl: "https://cdn.example.com/video-a.mp4",
        videoStoragePath: "/storage/videos/2026-04-03/video.mp4",
        videoUrl: "/storage/videos/2026-04-03/video.mp4",
        publishedAt: expect.any(Date),
        collectCount: 4,
        admireCount: 5,
        recommendCount: 6,
        tags: [],
      }),
    );
    expect(result).toMatchObject({
      lastSyncedAt: expect.any(Date),
    });
    expect(upsertProfileStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: "MY_ACCOUNT",
        accountId: "account_1",
        organizationId: "org_1",
        lastSuccessAt: expect.any(Date),
        nextSyncAt: expect.any(Date),
      }),
    );
  });

  it("updates sync profile state after processing a queued my-account job", async () => {
    douyinFindAccountByIdMock.mockResolvedValue({
      id: "account_1",
      userId: "user_1",
      organizationId: "org_1",
      profileUrl: "https://www.douyin.com/user/tester",
      secUserId: "sec_123",
    });
    findProfileByAccountMock.mockResolvedValue(null);
    findRecentPublishedAtMock.mockResolvedValue([
      new Date("2026-04-01T08:10:00+08:00"),
      new Date("2026-04-02T08:40:00+08:00"),
      new Date("2026-04-03T12:05:00+08:00"),
      new Date("2026-04-04T12:15:00+08:00"),
      new Date("2026-04-05T19:00:00+08:00"),
    ]);
    fetchVideoListMock.mockResolvedValue({
      videos: [
        {
          awemeId: "video_1",
          title: "视频 1",
          shareUrl: "https://www.iesdouyin.com/share/video/1",
          coverSourceUrl: null,
          videoSourceUrl: null,
          publishedAt: "2026-04-21T08:05:00+08:00",
          playCount: 10,
          likeCount: 2,
          commentCount: 1,
          shareCount: 0,
          collectCount: 4,
          admireCount: 5,
          recommendCount: 6,
        },
      ],
      hasMore: false,
      cursor: 0,
    });

    const { syncService } = await import("@/server/services/sync.service");

    await syncService.processCrawlerVideoSyncJob({
      accountType: "MY_ACCOUNT",
      accountId: "account_1",
      organizationId: "org_1",
    });

    expect(upsertProfileStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: "MY_ACCOUNT",
        accountId: "account_1",
        organizationId: "org_1",
        fastFollowUntil: expect.any(Date),
        nextSyncAt: expect.any(Date),
        publishWindowsJson: expect.any(Array),
      }),
    );
  });

  it("deduplicates crawler video-list fetches across my-account and benchmark batches", async () => {
    findAllAccountsMock.mockResolvedValue([
      {
        id: "account_1",
        organizationId: "org_1",
        profileUrl: "https://www.douyin.com/user/one",
        secUserId: "sec_shared",
      },
    ]);
    benchmarkFindAllMock.mockResolvedValue([
      {
        id: "benchmark_1",
        organizationId: "org_1",
        profileUrl: "https://www.douyin.com/user/shared",
        secUserId: "sec_shared",
      },
    ]);
    countByAccountIdMock.mockResolvedValue(0);
    findByVideoIdMock.mockResolvedValue(null);
    benchmarkFindVideoByAccountAndVideoIdMock.mockResolvedValue(null);
    fetchVideoListMock.mockResolvedValue({
      videos: [
        {
          awemeId: "video_1",
          title: "视频 1",
          shareUrl: "https://www.iesdouyin.com/share/video/1",
          coverSourceUrl: null,
          videoSourceUrl: null,
          publishedAt: null,
          playCount: 10,
          likeCount: 2,
          commentCount: 1,
          shareCount: 0,
          collectCount: 0,
          admireCount: 0,
          recommendCount: 0,
        },
      ],
      hasMore: false,
      cursor: 0,
    });

    const { syncService } = await import("@/server/services/sync.service");

    await expect(syncService.runVideoBatchSync()).resolves.toBeUndefined();
    expect(fetchVideoListMock).toHaveBeenCalledTimes(1);
    expect(fetchVideoListMock).toHaveBeenCalledWith("sec_shared", 0, 10, undefined);
    expect(upsertVideoMock).toHaveBeenCalledTimes(1);
    expect(benchmarkUpsertVideoMock).toHaveBeenCalledTimes(1);
  });

  it("records bannedAt when benchmark sync detects nickname equals douyinNumber", async () => {
    benchmarkFindAllMock.mockResolvedValue([
      {
        id: "benchmark_1",
        organizationId: "org_1",
        profileUrl: "https://www.douyin.com/user/shared",
        secUserId: "sec_banned",
        bannedAt: null,
      },
    ]);
    fetchUserProfileMock.mockResolvedValue({
      secUserId: "sec_banned",
      nickname: "abc123",
      avatar: "https://cdn.example.com/avatar.jpg",
      bio: null,
      signature: null,
      followersCount: 100,
      followingCount: 20,
      likesCount: 300,
      videosCount: 5,
      douyinNumber: "abc123",
      ipLocation: null,
      age: null,
      province: null,
      city: null,
      verificationLabel: null,
      verificationIconUrl: null,
      verificationType: null,
    });

    const { syncService } = await import("@/server/services/sync.service");

    await expect(syncService.runAccountInfoBatchSync()).resolves.toBeUndefined();
    expect(benchmarkUpdateAccountInfoMock).toHaveBeenCalledWith(
      "benchmark_1",
      expect.objectContaining({
        nickname: "abc123",
        douyinNumber: "abc123",
        bannedAt: expect.any(Date),
      }),
    );
  });

  it("keeps an existing bannedAt timestamp even when later sync payloads no longer match", async () => {
    const bannedAt = new Date("2026-04-16T08:00:00.000Z");
    benchmarkFindAllMock.mockResolvedValue([
      {
        id: "benchmark_1",
        organizationId: "org_1",
        profileUrl: "https://www.douyin.com/user/shared",
        secUserId: "sec_banned",
        bannedAt,
      },
    ]);
    fetchUserProfileMock.mockResolvedValue({
      secUserId: "sec_banned",
      nickname: "恢复后的昵称",
      avatar: "https://cdn.example.com/avatar.jpg",
      bio: null,
      signature: null,
      followersCount: 100,
      followingCount: 20,
      likesCount: 300,
      videosCount: 5,
      douyinNumber: "abc123",
      ipLocation: null,
      age: null,
      province: null,
      city: null,
      verificationLabel: null,
      verificationIconUrl: null,
      verificationType: null,
    });

    const { syncService } = await import("@/server/services/sync.service");

    await expect(syncService.runAccountInfoBatchSync()).resolves.toBeUndefined();
    expect(benchmarkUpdateAccountInfoMock).toHaveBeenCalledWith(
      "benchmark_1",
      expect.objectContaining({
        nickname: "恢复后的昵称",
        douyinNumber: "abc123",
        bannedAt,
      }),
    );
  });

  it("adds benchmark membership when collection sync rediscovers an existing organization benchmark", async () => {
    findAllMyAccountsForCollectionMock.mockResolvedValue([
      {
        id: "account_1",
        userId: "user_1",
        organizationId: "org_1",
        secUserId: "sec_owner_1",
        loginStatus: DouyinAccountLoginStatus.LOGGED_IN,
        favoriteCookieHeader: "sessionid=abc123",
      },
    ]);
    fetchCollectionVideosMock.mockResolvedValue({
      items: [
        {
          awemeId: "fav_1",
          authorSecUserId: "author_recent",
          collectedAt: null,
        },
      ],
      hasMore: false,
      cursor: 0,
    });
    benchmarkFindByOrgSecUserIdMock.mockResolvedValue({
      id: "benchmark_1",
      deletedAt: null,
    });

    const { syncService } = await import("@/server/services/sync.service");

    await expect(syncService.runCollectionSync()).resolves.toBeUndefined();
    expect(collectionCreateMock).toHaveBeenCalledWith({
      accountId: "account_1",
      awemeId: "fav_1",
      authorSecUserId: "author_recent",
    });
    expect(benchmarkUpsertMemberMock).toHaveBeenCalledWith({
      benchmarkAccountId: "benchmark_1",
      userId: "user_1",
      organizationId: "org_1",
      source: BenchmarkAccountMemberSource.COLLECTION_SYNC,
    });
    expect(benchmarkCreateWithMemberMock).not.toHaveBeenCalled();
  });

  it("limits first collection sync to 10 favorites on cold start", async () => {
    findAllMyAccountsForCollectionMock.mockResolvedValue([
      {
        id: "account_1",
        userId: "user_1",
        organizationId: "org_1",
        secUserId: "sec_owner_1",
        loginStatus: DouyinAccountLoginStatus.LOGGED_IN,
        favoriteCookieHeader: "sessionid=abc123",
      },
    ]);
    collectionExistsForAccountMock.mockResolvedValue(false);
    fetchCollectionVideosMock.mockResolvedValue({
      items: Array.from({ length: 10 }, (_, index) => ({
        awemeId: `fav_${index + 1}`,
        authorSecUserId: `author_${index + 1}`,
        collectedAt: null,
      })),
      hasMore: true,
      cursor: 10,
    });
    benchmarkFindByOrgSecUserIdMock.mockResolvedValue(null);
    fetchUserProfileMock.mockImplementation(async (secUserId: string) => ({
      secUserId,
      nickname: `nickname_${secUserId}`,
      avatar: "https://example.com/avatar.png",
      bio: null,
      signature: null,
      followersCount: 0,
      followingCount: 0,
      likesCount: 0,
      videosCount: 0,
      douyinNumber: null,
      ipLocation: null,
      age: null,
      province: null,
      city: null,
      verificationLabel: null,
      verificationIconUrl: null,
      verificationType: null,
    }));
    benchmarkCreateWithMemberMock.mockResolvedValue({
      id: "benchmark_created",
    });

    const { syncService } = await import("@/server/services/sync.service");

    await expect(syncService.runCollectionSync()).resolves.toBeUndefined();
    expect(fetchCollectionVideosMock).toHaveBeenCalledTimes(1);
    expect(fetchCollectionVideosMock).toHaveBeenCalledWith({
      cookieHeader: "sessionid=abc123",
      cursor: 0,
      count: 10,
    });
    expect(collectionCreateMock).toHaveBeenCalledTimes(10);
  });
});
