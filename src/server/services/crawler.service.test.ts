import { beforeEach, describe, expect, it, vi } from "vitest";

const { envMock } = vi.hoisted(() => ({
  envMock: {
    CRAWLER_API_URL: "http://localhost:8011",
    NODE_ENV: "development",
  },
}));

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

describe("crawlerService", () => {
  beforeEach(() => {
    envMock.CRAWLER_API_URL = "http://localhost:8011";
    envMock.NODE_ENV = "development";
    vi.restoreAllMocks();
  });

  it("gets secUserId from the crawler API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          sec_user_id: "sec_123",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { crawlerService } = await import("@/server/services/crawler.service");
    const result = await crawlerService.getSecUserId("https://www.douyin.com/user/tester");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8011/api/douyin/web/get_sec_user_id?url=https%3A%2F%2Fwww.douyin.com%2Fuser%2Ftester",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(result).toBe("sec_123");
  });

  it("maps crawler profile fields and logs the raw JSON response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          user: {
            sec_uid: "sec_123",
            nickname: "真实账号",
            avatar_larger: {
              url_list: ["https://cdn.example.com/avatar.jpg"],
            },
            signature: "账号简介",
            follower_count: 100,
            aweme_count: 10,
          },
        },
      }),
    });
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);

    const { crawlerService } = await import("@/server/services/crawler.service");
    const result = await crawlerService.fetchUserProfile("sec_123");

    expect(result).toEqual({
      secUserId: "sec_123",
      nickname: "真实账号",
      avatar: "https://cdn.example.com/avatar.jpg",
      bio: "账号简介",
      followersCount: 100,
      videosCount: 10,
    });
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[CrawlerService] /api/douyin/web/handler_user_profile response:",
      JSON.stringify({
        code: 200,
        data: {
          user: {
            sec_uid: "sec_123",
            nickname: "真实账号",
            avatar_larger: {
              url_list: ["https://cdn.example.com/avatar.jpg"],
            },
            signature: "账号简介",
            follower_count: 100,
            aweme_count: 10,
          },
        },
      }),
    );
  });

  it("maps crawler video list fields and logs pending downloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          aweme_list: [
            {
              aweme_id: "video_1",
              desc: "真实视频",
              video: {
                play_addr: {
                  url_list: ["https://cdn.example.com/video.mp4"],
                },
                cover: {
                  url_list: ["https://cdn.example.com/cover.jpg"],
                },
              },
              create_time: 1712102400,
              statistics: {
                play_count: 100,
                digg_count: 10,
                comment_count: 1,
                share_count: 2,
              },
            },
          ],
          has_more: 0,
          max_cursor: 99,
        },
      }),
    });
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);

    const { crawlerService } = await import("@/server/services/crawler.service");
    const result = await crawlerService.fetchVideoList("sec_123", 50);

    expect(result).toEqual({
      videos: [
        {
          awemeId: "video_1",
          title: "真实视频",
          coverUrl: "https://cdn.example.com/cover.jpg",
          videoUrl: "https://cdn.example.com/video.mp4",
          publishedAt: "2024-04-03T00:00:00.000Z",
          playCount: 100,
          likeCount: 10,
          commentCount: 1,
          shareCount: 2,
        },
      ],
      hasMore: false,
      cursor: 99,
    });
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[CrawlerService] 待下载封面: https://cdn.example.com/cover.jpg",
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[CrawlerService] 待下载视频: https://cdn.example.com/video.mp4",
    );
  });

  it("wraps collection videos with raw data passthrough", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          collection_list: [{ aweme_id: "fav_1" }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { crawlerService } = await import("@/server/services/crawler.service");
    const result = await crawlerService.fetchCollectionVideos("sec_123");

    expect(result).toEqual({
      collection_list: [{ aweme_id: "fav_1" }],
    });
  });

  it("maps single video stats from the crawler API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          aweme_detail: {
            aweme_id: "video_1",
            statistics: {
              play_count: 200,
              digg_count: 20,
              comment_count: 3,
              share_count: 4,
            },
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { crawlerService } = await import("@/server/services/crawler.service");
    const result = await crawlerService.fetchOneVideo("video_1");

    expect(result).toEqual({
      awemeId: "video_1",
      playCount: 200,
      likeCount: 20,
      commentCount: 3,
      shareCount: 4,
    });
  });

  it("throws AppError after crawler API retries are exhausted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const { crawlerService } = await import("@/server/services/crawler.service");

    await expect(
      crawlerService.getSecUserId("https://www.douyin.com/user/tester"),
    ).rejects.toMatchObject({
      code: "CRAWLER_ERROR",
      statusCode: 502,
    });
  });
});
