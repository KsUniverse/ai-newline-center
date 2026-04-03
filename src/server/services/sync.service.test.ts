import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchProfileMock,
  fetchVideosMock,
  findAccountByIdMock,
  findAllAccountsMock,
  updateAccountInfoMock,
  upsertVideoMock,
} = vi.hoisted(() => ({
  fetchProfileMock: vi.fn(),
  fetchVideosMock: vi.fn(),
  findAccountByIdMock: vi.fn(),
  findAllAccountsMock: vi.fn(),
  updateAccountInfoMock: vi.fn(),
  upsertVideoMock: vi.fn(),
}));

vi.mock("@/server/services/crawler.service", () => ({
  crawlerService: {
    fetchDouyinProfile: fetchProfileMock,
    fetchDouyinVideos: fetchVideosMock,
  },
}));

vi.mock("@/server/repositories/douyin-account.repository", () => ({
  douyinAccountRepository: {
    findById: findAccountByIdMock,
    findAll: findAllAccountsMock,
    updateAccountInfo: updateAccountInfoMock,
  },
}));

vi.mock("@/server/repositories/douyin-video.repository", () => ({
  douyinVideoRepository: {
    upsertByVideoId: upsertVideoMock,
  },
}));

describe("syncService", () => {
  beforeEach(() => {
    fetchProfileMock.mockReset();
    fetchVideosMock.mockReset();
    findAccountByIdMock.mockReset();
    findAllAccountsMock.mockReset();
    updateAccountInfoMock.mockReset();
    upsertVideoMock.mockReset();
  });

  it("syncs account info and videos for the caller's own account", async () => {
    findAccountByIdMock.mockResolvedValue({
      id: "account_1",
      userId: "user_1",
      organizationId: "org_1",
      profileUrl: "https://www.douyin.com/user/tester",
    });
    updateAccountInfoMock.mockImplementation(async (_id, data) => ({
      id: "account_1",
      ...data,
    }));
    fetchProfileMock.mockResolvedValue({
      nickname: "测试账号",
      avatar: "https://cdn.example.com/avatar.jpg",
      bio: null,
      followersCount: 100,
      videosCount: 5,
    });
    fetchVideosMock.mockResolvedValue({
      videos: [
        {
          videoId: "video_1",
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
    });

    const { syncService } = await import("@/server/services/sync.service");

    await expect(syncService.syncAccount("account_1", "user_2", "org_1")).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  it("continues account batch sync when one account fails", async () => {
    findAllAccountsMock.mockResolvedValue([
      {
        id: "account_1",
        userId: "user_1",
        profileUrl: "https://www.douyin.com/user/one",
      },
      {
        id: "account_2",
        userId: "user_2",
        profileUrl: "https://www.douyin.com/user/two",
      },
    ]);
    fetchProfileMock
      .mockRejectedValueOnce(new Error("crawler failed"))
      .mockResolvedValueOnce({
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
});
