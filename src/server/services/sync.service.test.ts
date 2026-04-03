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
      followersCount: 100,
      videosCount: 5,
    });
    countByAccountIdMock.mockResolvedValue(0);
    fetchVideoListMock.mockResolvedValue({
      videos: [
        {
          awemeId: "video_1",
          title: "视频 1",
          coverUrl: null,
          videoUrl: null,
          publishedAt: "2026-04-03T00:00:00.000Z",
          playCount: 10,
          likeCount: 2,
          commentCount: 1,
          shareCount: 0,
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
        lastSyncedAt: expect.any(Date),
      }),
    );
    expect(upsertVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "account_1",
        videoId: "video_1",
        publishedAt: expect.any(Date),
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
          videoUrl: null,
          publishedAt: null,
          playCount: 5,
          likeCount: 1,
          commentCount: 0,
          shareCount: 0,
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
        followersCount: 20,
        videosCount: 3,
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
});
