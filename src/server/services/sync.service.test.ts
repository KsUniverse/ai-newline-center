import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createBenchmarkMock,
  collectionCreateMock,
  collectionExistsByAwemeIdMock,
  collectionExistsForAccountMock,
  fetchCollectionVideosMock,
  fetchUserProfileMock,
  fetchVideoListMock,
  getSecUserIdMock,
  findAccountByIdMock,
  findAllAccountsMock,
  findAllMyAccountsForCollectionMock,
  findAllActiveVideosMock,
  findAllActiveVideosForSnapshotSyncMock,
  findBySecUserIdIncludingDeletedMock,
  countByAccountIdMock,
  findByVideoIdMock,
  createSnapshotMock,
  downloadAndStoreMock,
  updateAccountInfoMock,
  markLoginExpiredMock,
  updateStatsMock,
  updateSecUserIdMock,
  upsertVideoMock,
} = vi.hoisted(() => ({
  createBenchmarkMock: vi.fn(),
  collectionCreateMock: vi.fn(),
  collectionExistsByAwemeIdMock: vi.fn(),
  collectionExistsForAccountMock: vi.fn(),
  fetchCollectionVideosMock: vi.fn(),
  fetchUserProfileMock: vi.fn(),
  fetchVideoListMock: vi.fn(),
  getSecUserIdMock: vi.fn(),
  findAccountByIdMock: vi.fn(),
  findAllAccountsMock: vi.fn(),
  findAllMyAccountsForCollectionMock: vi.fn(),
  findAllActiveVideosMock: vi.fn(),
  findAllActiveVideosForSnapshotSyncMock: vi.fn(),
  findBySecUserIdIncludingDeletedMock: vi.fn(),
  countByAccountIdMock: vi.fn(),
  findByVideoIdMock: vi.fn(),
  createSnapshotMock: vi.fn(),
  downloadAndStoreMock: vi.fn(),
  updateAccountInfoMock: vi.fn(),
  markLoginExpiredMock: vi.fn(),
  updateStatsMock: vi.fn(),
  updateSecUserIdMock: vi.fn(),
  upsertVideoMock: vi.fn(),
}));

vi.mock("@/server/services/crawler.service", () => ({
  crawlerService: {
    fetchCollectionVideos: fetchCollectionVideosMock,
    fetchUserProfile: fetchUserProfileMock,
    fetchVideoList: fetchVideoListMock,
    getSecUserId: getSecUserIdMock,
    fetchOneVideo: vi.fn(),
  },
}));

vi.mock("@/server/repositories/douyin-account.repository", () => ({
  douyinAccountRepository: {
    createBenchmark: createBenchmarkMock,
    findById: findAccountByIdMock,
    findAll: findAllAccountsMock,
    findAllMyAccountsForCollection: findAllMyAccountsForCollectionMock,
    findBySecUserIdIncludingDeleted: findBySecUserIdIncludingDeletedMock,
    markLoginExpired: markLoginExpiredMock,
    updateAccountInfo: updateAccountInfoMock,
    updateSecUserId: updateSecUserIdMock,
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
    findByVideoId: findByVideoIdMock,
    findAllActive: findAllActiveVideosMock,
    findAllActiveForSnapshotSync: findAllActiveVideosForSnapshotSyncMock,
    updateStats: updateStatsMock,
    upsertByVideoId: upsertVideoMock,
  },
}));

vi.mock("@/server/repositories/video-snapshot.repository", () => ({
  videoSnapshotRepository: {
    create: createSnapshotMock,
  },
}));

vi.mock("@/server/services/storage.service", () => ({
  storageService: {
    downloadAndStore: downloadAndStoreMock,
  },
}));

describe("syncService", () => {
  beforeEach(() => {
    createBenchmarkMock.mockReset();
    collectionCreateMock.mockReset();
    collectionExistsByAwemeIdMock.mockReset();
    collectionExistsForAccountMock.mockReset();
    fetchCollectionVideosMock.mockReset();
    fetchUserProfileMock.mockReset();
    fetchVideoListMock.mockReset();
    getSecUserIdMock.mockReset();
    findAccountByIdMock.mockReset();
    findAllAccountsMock.mockReset();
    findAllMyAccountsForCollectionMock.mockReset();
    findAllActiveVideosMock.mockReset();
    findAllActiveVideosForSnapshotSyncMock.mockReset();
    findBySecUserIdIncludingDeletedMock.mockReset();
    countByAccountIdMock.mockReset();
    findByVideoIdMock.mockReset();
    createSnapshotMock.mockReset();
    downloadAndStoreMock.mockReset();
    markLoginExpiredMock.mockReset();
    updateAccountInfoMock.mockReset();
    updateStatsMock.mockReset();
    updateSecUserIdMock.mockReset();
    upsertVideoMock.mockReset();
    collectionCreateMock.mockResolvedValue(undefined);
    collectionExistsByAwemeIdMock.mockResolvedValue(false);
    collectionExistsForAccountMock.mockResolvedValue(false);
  });

  it("backfills secUserId and syncs account info for the caller's own account", async () => {
    findAccountByIdMock.mockResolvedValue({
      id: "account_1",
      userId: "user_1",
      organizationId: "org_1",
      profileUrl: "https://www.douyin.com/user/tester",
      secUserId: null,
    });
    updateAccountInfoMock.mockImplementation(async (_id, data) => ({
      id: "account_1",
      ...data,
    }));
    updateSecUserIdMock.mockResolvedValue({
      id: "account_1",
      secUserId: "sec_123",
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
      verificationLabel: "慧研智投科技有限公司一般证券从业人员",
      verificationIconUrl: "https://lf3-static.bytednsdoc.com/yellow-v.png",
      verificationType: 0,
    });
    countByAccountIdMock.mockResolvedValue(0);
    downloadAndStoreMock
      .mockResolvedValueOnce("/storage/covers/2026-04-03/cover.gif")
      .mockResolvedValueOnce("/storage/videos/2026-04-03/video.mp4");
    fetchVideoListMock.mockResolvedValue({
      videos: [
        {
          awemeId: "video_1",
          title: "视频 1",
          coverUrl: null,
          coverSourceUrl: "https://cdn.example.com/cover-a.gif",
          videoUrl: null,
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
    });
    upsertVideoMock.mockResolvedValue(undefined);

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
        verificationLabel: "慧研智投科技有限公司一般证券从业人员",
        verificationIconUrl: "https://lf3-static.bytednsdoc.com/yellow-v.png",
        verificationType: 0,
        lastSyncedAt: expect.any(Date),
      }),
    );
    expect(upsertVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "account_1",
        videoId: "video_1",
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

  it("throws FORBIDDEN when syncing another user's account", async () => {
    findAccountByIdMock.mockResolvedValue({
      id: "account_1",
      userId: "user_1",
      organizationId: "org_1",
      profileUrl: "https://www.douyin.com/user/tester",
      secUserId: "sec_123",
    });

    const { syncService } = await import("@/server/services/sync.service");

    await expect(syncService.syncAccount("account_1", "user_2", "org_1")).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  it("stops incremental sync when an existing video is encountered", async () => {
    findAllAccountsMock.mockResolvedValue([
      {
        id: "account_1",
        userId: "user_1",
        organizationId: "org_1",
        profileUrl: "https://www.douyin.com/user/one",
        secUserId: "sec_123",
      },
    ]);
    countByAccountIdMock.mockResolvedValue(1);
    fetchVideoListMock.mockResolvedValue({
      videos: [
        {
          awemeId: "video_1",
          title: "旧视频",
          coverUrl: null,
          coverSourceUrl: "https://cdn.example.com/cover.gif",
          videoUrl: null,
          videoSourceUrl: "https://cdn.example.com/video.mp4",
          publishedAt: null,
          playCount: 5,
          likeCount: 1,
          commentCount: 0,
          shareCount: 0,
          collectCount: 0,
          admireCount: 0,
          recommendCount: 0,
        },
      ],
      hasMore: true,
      cursor: 100,
    });
    findByVideoIdMock.mockResolvedValue({
      id: "db_video_1",
      videoId: "video_1",
    });

    const { syncService } = await import("@/server/services/sync.service");

    await expect(syncService.runVideoBatchSync()).resolves.toBeUndefined();
    expect(fetchVideoListMock).toHaveBeenCalledWith("sec_123", 0, 5);
    expect(upsertVideoMock).not.toHaveBeenCalled();
  });

  it("continues account batch sync when one account fails", async () => {
    findAllAccountsMock.mockResolvedValue([
      {
        id: "account_1",
        userId: "user_1",
        profileUrl: "https://www.douyin.com/user/one",
        secUserId: "sec_111",
      },
      {
        id: "account_2",
        userId: "user_2",
        profileUrl: "https://www.douyin.com/user/two",
        secUserId: "sec_222",
      },
    ]);
    fetchUserProfileMock
      .mockRejectedValueOnce(new Error("crawler failed"))
      .mockResolvedValueOnce({
        secUserId: "sec_222",
        nickname: "账号二",
        avatar: "https://cdn.example.com/avatar-2.jpg",
        bio: null,
        signature: null,
        followersCount: 20,
        followingCount: 0,
        likesCount: 0,
        videosCount: 3,
        douyinNumber: null,
        ipLocation: null,
        age: null,
        province: null,
        city: null,
        verificationLabel: null,
        verificationIconUrl: null,
        verificationType: null,
      });
    updateAccountInfoMock.mockResolvedValue({
      id: "account_2",
      lastSyncedAt: new Date("2026-04-03T00:00:00.000Z"),
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { syncService } = await import("@/server/services/sync.service");

    await expect(syncService.runAccountInfoBatchSync()).resolves.toBeUndefined();
    expect(updateAccountInfoMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("collects one snapshot per active video and updates current counters", async () => {
    const { crawlerService } = await import("@/server/services/crawler.service");
    vi.mocked(crawlerService.fetchOneVideo).mockResolvedValue({
      awemeId: "video_1",
      playCount: 100,
      likeCount: 10,
      commentCount: 1,
      shareCount: 2,
    });
    findAllActiveVideosForSnapshotSyncMock.mockResolvedValue([
      {
        id: "db_video_1",
        videoId: "video_1",
        publishedAt: new Date("2026-04-03T00:00:00.000Z"),
        snapshots: [],
      },
    ]);

    const { syncService } = await import("@/server/services/sync.service");

    await expect(syncService.runVideoSnapshotCollection()).resolves.toBeUndefined();
    expect(createSnapshotMock).toHaveBeenCalledWith({
      videoId: "db_video_1",
      playsCount: 100,
      likesCount: 10,
      commentsCount: 1,
      sharesCount: 2,
    });
    expect(updateStatsMock).toHaveBeenCalledWith("db_video_1", {
      playCount: 100,
      likeCount: 10,
      commentCount: 1,
      shareCount: 2,
    });
  });

  it("skips or throttles snapshot sync based on video age and last snapshot time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T12:00:00.000Z"));

    const { crawlerService } = await import("@/server/services/crawler.service");
    vi.mocked(crawlerService.fetchOneVideo).mockResolvedValue({
      awemeId: "video_recent_should_sync",
      playCount: 100,
      likeCount: 10,
      commentCount: 1,
      shareCount: 2,
    });
    findAllActiveVideosForSnapshotSyncMock.mockResolvedValue([
      {
        id: "video_recent_should_sync",
        videoId: "video_recent_should_sync",
        publishedAt: new Date("2026-04-05T11:00:00.000Z"),
        collectCount: 0,
        admireCount: 0,
        recommendCount: 0,
        snapshots: [
          {
            timestamp: new Date("2026-04-05T11:49:00.000Z"),
          },
        ],
      },
      {
        id: "video_recent_skip",
        videoId: "video_recent_skip",
        publishedAt: new Date("2026-04-05T10:00:00.000Z"),
        collectCount: 0,
        admireCount: 0,
        recommendCount: 0,
        snapshots: [
          {
            timestamp: new Date("2026-04-05T11:55:00.000Z"),
          },
        ],
      },
      {
        id: "video_mid_term_should_sync",
        videoId: "video_mid_term_should_sync",
        publishedAt: new Date("2026-04-04T06:00:00.000Z"),
        collectCount: 0,
        admireCount: 0,
        recommendCount: 0,
        snapshots: [
          {
            timestamp: new Date("2026-04-05T10:30:00.000Z"),
          },
        ],
      },
      {
        id: "video_mid_term_skip",
        videoId: "video_mid_term_skip",
        publishedAt: new Date("2026-04-04T07:00:00.000Z"),
        collectCount: 0,
        admireCount: 0,
        recommendCount: 0,
        snapshots: [
          {
            timestamp: new Date("2026-04-05T11:30:00.000Z"),
          },
        ],
      },
      {
        id: "video_old_skip",
        videoId: "video_old_skip",
        publishedAt: new Date("2026-04-01T07:00:00.000Z"),
        collectCount: 0,
        admireCount: 0,
        recommendCount: 0,
        snapshots: [],
      },
    ]);

    const { syncService } = await import("@/server/services/sync.service");

    await expect(syncService.runVideoSnapshotCollection()).resolves.toBeUndefined();
    expect(crawlerService.fetchOneVideo).toHaveBeenCalledTimes(3);
    expect(crawlerService.fetchOneVideo).toHaveBeenCalledWith("video_recent_should_sync");
    expect(crawlerService.fetchOneVideo).toHaveBeenCalledWith("video_recent_skip");
    expect(crawlerService.fetchOneVideo).toHaveBeenCalledWith("video_mid_term_should_sync");
    expect(crawlerService.fetchOneVideo).not.toHaveBeenCalledWith("video_mid_term_skip");
    expect(crawlerService.fetchOneVideo).not.toHaveBeenCalledWith("video_old_skip");

    vi.useRealTimers();
  });

  it("selects the first reachable cover and video source before storing resources", async () => {
    findAccountByIdMock.mockResolvedValue({
      id: "account_1",
      userId: "user_1",
      organizationId: "org_1",
      profileUrl: "https://www.douyin.com/user/tester",
      secUserId: "sec_123",
    });
    updateAccountInfoMock.mockResolvedValue({
      id: "account_1",
      lastSyncedAt: new Date("2026-04-03T00:00:00.000Z"),
    });
    countByAccountIdMock.mockResolvedValue(0);
    fetchUserProfileMock.mockResolvedValue({
      secUserId: "sec_123",
      nickname: "测试账号",
      avatar: "https://cdn.example.com/avatar.jpg",
      bio: null,
      signature: null,
      followersCount: 100,
      followingCount: 10,
      likesCount: 20,
      videosCount: 1,
      douyinNumber: null,
      ipLocation: null,
      age: null,
      province: null,
      city: null,
      verificationLabel: null,
      verificationIconUrl: null,
      verificationType: null,
    });
    fetchVideoListMock.mockResolvedValue({
      videos: [
        {
          awemeId: "video_2",
          title: "视频 2",
          coverUrl: "storage/covers/cover-2.gif",
          coverSourceUrl: "https://cdn.example.com/cover-ok.gif",
          videoUrl: "storage/videos/video-2.mp4",
          videoSourceUrl: "https://cdn.example.com/video-ok.mp4",
          publishedAt: "2026-04-03T00:00:00.000Z",
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
    });
    downloadAndStoreMock
      .mockResolvedValueOnce("/storage/covers/cover-2.gif")
      .mockResolvedValueOnce("/storage/videos/video-2.mp4");

    const { syncService } = await import("@/server/services/sync.service");

    await syncService.syncAccount("account_1", "user_1", "org_1");

    expect(downloadAndStoreMock).toHaveBeenCalledWith(
      "https://cdn.example.com/cover-ok.gif",
      "covers",
    );
    expect(downloadAndStoreMock).toHaveBeenCalledWith(
      "https://cdn.example.com/video-ok.mp4",
      "videos",
    );
  });

  it("cold-start collection sync only fetches one page and records ownership", async () => {
    findAllMyAccountsForCollectionMock.mockResolvedValue([
      {
        id: "account_1",
        userId: "user_1",
        organizationId: "org_1",
        secUserId: "sec_owner_1",
        loginStatus: "LOGGED_IN",
        loginStatePath: "D:/private/account-1.json",
        favoriteCookieHeader: "sessionid=abc123; uid_tt=xyz456",
      },
    ]);
    fetchCollectionVideosMock.mockResolvedValue({
      items: [
        {
          awemeId: "fav_1",
          authorSecUserId: "author_recent",
          collectedAt: null,
        },
        {
          awemeId: "fav_2",
          authorSecUserId: "author_recent_2",
          collectedAt: null,
        },
      ],
      hasMore: true,
      cursor: 30,
    });
    findBySecUserIdIncludingDeletedMock.mockResolvedValue(null);
    fetchUserProfileMock
      .mockResolvedValueOnce({
        secUserId: "author_recent",
        nickname: "对标作者",
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
      })
      .mockResolvedValueOnce({
        secUserId: "author_recent_2",
        nickname: "对标作者 2",
        avatar: "https://cdn.example.com/avatar-2.jpg",
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
    createBenchmarkMock.mockResolvedValue({
      id: "benchmark_1",
    });
    collectionExistsForAccountMock.mockResolvedValue(false);

    const { syncService } = await import("@/server/services/sync.service");

    await expect(syncService.runCollectionSync()).resolves.toBeUndefined();
    expect(fetchCollectionVideosMock).toHaveBeenCalledWith({
      cookieHeader: "sessionid=abc123; uid_tt=xyz456",
      cursor: 0,
      count: 30,
    });
    expect(fetchCollectionVideosMock).toHaveBeenCalledTimes(1);
    expect(collectionCreateMock).toHaveBeenNthCalledWith(1, {
      accountId: "account_1",
      awemeId: "fav_1",
      authorSecUserId: "author_recent",
    });
    expect(collectionCreateMock).toHaveBeenNthCalledWith(2, {
      accountId: "account_1",
      awemeId: "fav_2",
      authorSecUserId: "author_recent_2",
    });
    expect(createBenchmarkMock).toHaveBeenCalledWith({
      profileUrl: "https://www.douyin.com/user/author_recent",
      secUserId: "author_recent",
      nickname: "对标作者",
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
      userId: "user_1",
      organizationId: "org_1",
    });
    expect(fetchUserProfileMock).toHaveBeenCalledTimes(2);
  });

  it("continues paging until an existing collection video is encountered", async () => {
    findAllMyAccountsForCollectionMock.mockResolvedValue([
      {
        id: "account_1",
        userId: "user_1",
        organizationId: "org_1",
        secUserId: "sec_owner_1",
        loginStatus: "LOGGED_IN",
        loginStatePath: "D:/private/account-1.json",
        favoriteCookieHeader: "sessionid=abc123; uid_tt=xyz456",
      },
    ]);
    fetchCollectionVideosMock
      .mockResolvedValueOnce({
        items: [
          {
            awemeId: "fav_1",
            authorSecUserId: "author_recent_1",
            collectedAt: null,
          },
          {
            awemeId: "fav_2",
            authorSecUserId: "author_recent_2",
            collectedAt: null,
          },
        ],
        hasMore: true,
        cursor: 30,
      })
      .mockResolvedValueOnce({
        items: [
          {
            awemeId: "fav_3",
            authorSecUserId: "author_seen",
            collectedAt: null,
          },
          {
            awemeId: "fav_4",
            authorSecUserId: "author_should_not_run",
            collectedAt: null,
          },
        ],
        hasMore: true,
        cursor: 60,
      });
    findBySecUserIdIncludingDeletedMock.mockResolvedValue(null);
    fetchUserProfileMock
      .mockResolvedValueOnce({
        secUserId: "author_recent_1",
        nickname: "对标作者 1",
        avatar: "https://cdn.example.com/avatar-1.jpg",
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
      })
      .mockResolvedValueOnce({
        secUserId: "author_recent_2",
        nickname: "对标作者 2",
        avatar: "https://cdn.example.com/avatar-2.jpg",
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
    createBenchmarkMock.mockResolvedValue({ id: "benchmark_1" });
    collectionExistsForAccountMock.mockResolvedValue(true);
    collectionExistsByAwemeIdMock
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const { syncService } = await import("@/server/services/sync.service");

    await expect(syncService.runCollectionSync()).resolves.toBeUndefined();
    expect(fetchCollectionVideosMock).toHaveBeenNthCalledWith(1, {
      cookieHeader: "sessionid=abc123; uid_tt=xyz456",
      cursor: 0,
      count: 30,
    });
    expect(fetchCollectionVideosMock).toHaveBeenNthCalledWith(2, {
      cookieHeader: "sessionid=abc123; uid_tt=xyz456",
      cursor: 30,
      count: 30,
    });
    expect(fetchCollectionVideosMock).toHaveBeenCalledTimes(2);
    expect(collectionCreateMock).toHaveBeenCalledTimes(2);
    expect(findBySecUserIdIncludingDeletedMock).not.toHaveBeenCalledWith("author_should_not_run");
  });

  it("skips accounts without login state files instead of marking them expired", async () => {
    findAllMyAccountsForCollectionMock.mockResolvedValue([
      {
        id: "account_1",
        userId: "user_1",
        organizationId: "org_1",
        secUserId: "sec_owner_1",
        loginStatus: "NOT_LOGGED_IN",
        loginStatePath: null,
        favoriteCookieHeader: null,
      },
    ]);

    const { syncService } = await import("@/server/services/sync.service");

    await expect(syncService.runCollectionSync()).resolves.toBeUndefined();
    expect(markLoginExpiredMock).not.toHaveBeenCalled();
    expect(fetchCollectionVideosMock).not.toHaveBeenCalled();
  });

  it("marks account expired when favorite request cookie header is missing", async () => {
    findAllMyAccountsForCollectionMock.mockResolvedValue([
      {
        id: "account_1",
        userId: "user_1",
        organizationId: "org_1",
        secUserId: "sec_owner_1",
        loginStatus: "LOGGED_IN",
        loginStatePath: "D:/private/account-1.json",
        favoriteCookieHeader: null,
      },
    ]);

    const { syncService } = await import("@/server/services/sync.service");

    await expect(syncService.runCollectionSync()).resolves.toBeUndefined();
    expect(markLoginExpiredMock).toHaveBeenCalledWith(
      "account_1",
      "账号收藏同步 Cookie 已失效，请重新登录",
    );
    expect(fetchCollectionVideosMock).not.toHaveBeenCalled();
  });
});
