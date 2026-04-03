import { beforeEach, describe, expect, it, vi } from "vitest";

const { envMock } = vi.hoisted(() => ({
  envMock: {
    CRAWLER_API_URL: undefined as string | undefined,
    NODE_ENV: "development",
  },
}));

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

describe("crawlerService.fetchDouyinProfile", () => {
  beforeEach(() => {
    envMock.CRAWLER_API_URL = undefined;
    envMock.NODE_ENV = "development";
    vi.restoreAllMocks();
  });

  it("returns mock profile data in development when crawler API is not configured", async () => {
    const { crawlerService } = await import("@/server/services/crawler.service");

    const result = await crawlerService.fetchDouyinProfile("https://www.douyin.com/user/tester");

    expect(result.profileUrl).toBe("https://www.douyin.com/user/tester");
    expect(result.nickname).toContain("模拟账号");
    expect(result.followersCount).toBeGreaterThanOrEqual(0);
  });

  it("calls the crawler API when CRAWLER_API_URL is configured", async () => {
    envMock.CRAWLER_API_URL = "https://crawler.example.com";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        profileUrl: "https://www.douyin.com/user/tester",
        nickname: "真实账号",
        avatar: "https://cdn.example.com/avatar.jpg",
        bio: null,
        followersCount: 100,
        videosCount: 10,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { crawlerService } = await import("@/server/services/crawler.service");
    const result = await crawlerService.fetchDouyinProfile("https://www.douyin.com/user/tester");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://crawler.example.com/douyin/user/profile",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.nickname).toBe("真实账号");
  });

  it("throws AppError after crawler API retries are exhausted", async () => {
    envMock.CRAWLER_API_URL = "https://crawler.example.com";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const { crawlerService } = await import("@/server/services/crawler.service");

    await expect(
      crawlerService.fetchDouyinProfile("https://www.douyin.com/user/tester"),
    ).rejects.toMatchObject({
      code: "CRAWLER_ERROR",
      statusCode: 502,
    });
  });

  it("returns mock videos in development when crawler API is not configured", async () => {
    const { crawlerService } = await import("@/server/services/crawler.service");

    const result = await crawlerService.fetchDouyinVideos(
      "https://www.douyin.com/user/tester",
      1,
    );

    expect(result.videos).toHaveLength(8);
    expect(result.hasMore).toBe(false);
    expect(result.videos[0]?.videoId).toContain("mock_tester");
  });

  it("returns empty mock videos from the second page", async () => {
    const { crawlerService } = await import("@/server/services/crawler.service");

    const result = await crawlerService.fetchDouyinVideos(
      "https://www.douyin.com/user/tester",
      2,
    );

    expect(result).toEqual({
      videos: [],
      hasMore: false,
    });
  });

  it("calls the crawler API for videos when configured", async () => {
    envMock.CRAWLER_API_URL = "https://crawler.example.com";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        videos: [
          {
            videoId: "video_1",
            title: "真实视频",
            coverUrl: null,
            videoUrl: null,
            publishedAt: "2026-04-03T00:00:00.000Z",
            playCount: 100,
            likeCount: 10,
            commentCount: 1,
            shareCount: 2,
          },
        ],
        hasMore: false,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { crawlerService } = await import("@/server/services/crawler.service");
    const result = await crawlerService.fetchDouyinVideos(
      "https://www.douyin.com/user/tester",
      1,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://crawler.example.com/douyin/user/videos",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.videos[0]?.videoId).toBe("video_1");
  });
});
