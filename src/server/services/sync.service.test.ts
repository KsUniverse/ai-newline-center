import {
  BenchmarkAccountMemberSource,
  DouyinAccountLoginStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
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
  findFirstActiveShareCookieMock,
  findAllActiveVideosForSnapshotSyncMock,
  findAllAccountsMock,
  findAllMyAccountsForCollectionMock,
  findByVideoIdMock,
  getSecUserIdMock,
  markLoginExpiredMock,
  updateAccountInfoMock,
  updateSecUserIdMock,
  updateStatsMock,
  upsertVideoMock,
  videoSnapshotCreateMock,
} = vi.hoisted(() => ({
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
  findFirstActiveShareCookieMock: vi.fn(),
  findAllActiveVideosForSnapshotSyncMock: vi.fn(),
  findAllAccountsMock: vi.fn(),
  findAllMyAccountsForCollectionMock: vi.fn(),
  findByVideoIdMock: vi.fn(),
  getSecUserIdMock: vi.fn(),
  markLoginExpiredMock: vi.fn(),
  updateAccountInfoMock: vi.fn(),
  updateSecUserIdMock: vi.fn(),
  updateStatsMock: vi.fn(),
  upsertVideoMock: vi.fn(),
  videoSnapshotCreateMock: vi.fn(),
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
    updateStats: benchmarkUpdateStatsMock,
    updateStatsByAccountVideoId: benchmarkUpdateStatsByAccountVideoIdMock,
    upsertByVideoId: benchmarkUpsertVideoMock,
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
    findFirstActiveShareCookieMock.mockReset();
    findAllActiveVideosForSnapshotSyncMock.mockReset();
    findAllAccountsMock.mockReset();
    findAllMyAccountsForCollectionMock.mockReset();
    findByVideoIdMock.mockReset();
    getSecUserIdMock.mockReset();
    markLoginExpiredMock.mockReset();
    updateAccountInfoMock.mockReset();
    updateSecUserIdMock.mockReset();
    updateStatsMock.mockReset();
    upsertVideoMock.mockReset();
    videoSnapshotCreateMock.mockReset();

    benchmarkFindAllMock.mockResolvedValue([]);
    collectionCreateMock.mockResolvedValue(undefined);
    collectionExistsByAwemeIdMock.mockResolvedValue(false);
    collectionExistsForAccountMock.mockResolvedValue(false);
    countByAccountIdMock.mockResolvedValue(0);
    downloadAndStoreMock.mockResolvedValue(null);
    findAllActiveVideosForSnapshotSyncMock.mockResolvedValue([]);
    findAllAccountsMock.mockResolvedValue([]);
    findFirstActiveShareCookieMock.mockResolvedValue(null);
    findByVideoIdMock.mockResolvedValue(null);
    updateAccountInfoMock.mockResolvedValue({
      id: "account_1",
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
    expect(fetchVideoListMock).toHaveBeenCalledWith("sec_123", 0, 10);
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
    expect(fetchVideoListMock).toHaveBeenCalledWith("sec_shared", 0, 10);
    expect(upsertVideoMock).toHaveBeenCalledTimes(1);
    expect(benchmarkUpsertVideoMock).toHaveBeenCalledTimes(1);
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
});
