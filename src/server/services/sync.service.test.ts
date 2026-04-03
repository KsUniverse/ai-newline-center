import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchUserProfileMock,
  fetchVideoListMock,
  getSecUserIdMock,
  findAccountByIdMock,
  findAllAccountsMock,
  findAllActiveVideosMock,
  countByAccountIdMock,
  findByVideoIdMock,
  createSnapshotMock,
  downloadAndStoreMock,
  updateAccountInfoMock,
  updateStatsMock,
  updateSecUserIdMock,
  upsertVideoMock,
} = vi.hoisted(() => ({
  fetchUserProfileMock: vi.fn(),
  fetchVideoListMock: vi.fn(),
  getSecUserIdMock: vi.fn(),
  findAccountByIdMock: vi.fn(),
  findAllAccountsMock: vi.fn(),
  findAllActiveVideosMock: vi.fn(),
  countByAccountIdMock: vi.fn(),
  findByVideoIdMock: vi.fn(),
  createSnapshotMock: vi.fn(),
  downloadAndStoreMock: vi.fn(),
  updateAccountInfoMock: vi.fn(),
  updateStatsMock: vi.fn(),
  updateSecUserIdMock: vi.fn(),
  upsertVideoMock: vi.fn(),
}));

vi.mock("@/server/services/crawler.service", () => ({
  crawlerService: {
    fetchUserProfile: fetchUserProfileMock,
    fetchVideoList: fetchVideoListMock,
    getSecUserId: getSecUserIdMock,
    fetchOneVideo: vi.fn(),
  },
}));

vi.mock("@/server/repositories/douyin-account.repository", () => ({
  douyinAccountRepository: {
    findById: findAccountByIdMock,
    findAll: findAllAccountsMock,
    updateAccountInfo: updateAccountInfoMock,
    updateSecUserId: updateSecUserIdMock,
  },
}));

vi.mock("@/server/repositories/douyin-video.repository", () => ({
  douyinVideoRepository: {
    countByAccountId: countByAccountIdMock,
    findByVideoId: findByVideoIdMock,
    findAllActive: findAllActiveVideosMock,
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
    fetchUserProfileMock.mockReset();
    fetchVideoListMock.mockReset();
    getSecUserIdMock.mockReset();
    findAccountByIdMock.mockReset();
    findAllAccountsMock.mockReset();
    findAllActiveVideosMock.mockReset();
    countByAccountIdMock.mockReset();
    findByVideoIdMock.mockReset();
    createSnapshotMock.mockReset();
    downloadAndStoreMock.mockReset();
    updateAccountInfoMock.mockReset();
    updateStatsMock.mockReset();
    updateSecUserIdMock.mockReset();
    upsertVideoMock.mockReset();
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
    findAllActiveVideosMock.mockResolvedValue([
      {
        id: "db_video_1",
        videoId: "video_1",
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
});
