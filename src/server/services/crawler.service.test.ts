import { beforeEach, describe, expect, it, vi } from "vitest";

const { envMock } = vi.hoisted(() => ({
  envMock: {
    CRAWLER_API_URL: "http://47.96.227.116:8011",
    NODE_ENV: "development",
  },
}));

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

describe("crawlerService", () => {
  beforeEach(() => {
    envMock.CRAWLER_API_URL = "http://47.96.227.116:8011";
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
      "http://47.96.227.116:8011/api/douyin/web/get_sec_user_id?url=https%3A%2F%2Fwww.douyin.com%2Fuser%2Ftester",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(result).toBe("sec_123");
  });

  it("accepts a plain string secUserId response from the crawler API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        data: "sec_string_123",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { crawlerService } = await import("@/server/services/crawler.service");
    const result = await crawlerService.getSecUserId("https://www.douyin.com/user/tester");

    expect(result).toBe("sec_string_123");
  });

  it("maps crawler profile fields and logs the response code", async () => {
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
    vi.stubGlobal("fetch", fetchMock);

    const { crawlerService } = await import("@/server/services/crawler.service");
    const result = await crawlerService.fetchUserProfile("sec_123");

    expect(result).toMatchObject({
      secUserId: "sec_123",
      nickname: "真实账号",
      avatar: "https://cdn.example.com/avatar.jpg",
      bio: "账号简介",
      signature: "账号简介",
      followersCount: 100,
      followingCount: 0,
      likesCount: 0,
      videosCount: 10,
      douyinNumber: null,
      ipLocation: null,
      age: null,
      province: null,
      city: null,
      verificationLabel: null,
      verificationIconUrl: null,
      verificationType: null,
    });
  });

  it("maps extended profile fields for official-style account cards", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          user: {
            sec_uid: "sec_123",
            nickname: "股道寻龙",
            avatar_larger: {
              url_list: ["https://p3-pc.douyinpic.com/avatar.jpeg"],
            },
            signature: "十年磨一剑，逆风翻盘。",
            follower_count: 14436,
            following_count: 428,
            total_favorited: 38352,
            aweme_count: 3,
            unique_id: "49001906753",
            ip_location: "IP属地：湖北",
            user_age: 36,
            province: "湖北",
            city: "武汉",
            verification_type: 0,
            endorsement_info_list: [
              {
                text: "慧研智投科技有限公司一般证券从业人员",
                light_icon_url: "https://lf3-static.bytednsdoc.com/yellow-v.png",
              },
            ],
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { crawlerService } = await import("@/server/services/crawler.service");
    const result = await crawlerService.fetchUserProfile("sec_123");

    expect(result).toEqual({
      secUserId: "sec_123",
      nickname: "股道寻龙",
      avatar: "https://p3-pc.douyinpic.com/avatar.jpeg",
      bio: "十年磨一剑，逆风翻盘。",
      signature: "十年磨一剑，逆风翻盘。",
      followersCount: 14436,
      followingCount: 428,
      likesCount: 38352,
      videosCount: 3,
      douyinNumber: "49001906753",
      ipLocation: "IP属地：湖北",
      age: 36,
      province: "湖北",
      city: "武汉",
      verificationLabel: "慧研智投科技有限公司一般证券从业人员",
      verificationIconUrl: "https://lf3-static.bytednsdoc.com/yellow-v.png",
      verificationType: 0,
    });
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
          shareUrl: null,
          coverUrl: null,
          coverSourceUrl: "https://cdn.example.com/cover.jpg",
          videoUrl: null,
          videoSourceUrl: "https://cdn.example.com/video.mp4",
          publishedAt: "2024-04-03T00:00:00.000Z",
          playCount: 100,
          likeCount: 10,
          commentCount: 1,
          shareCount: 2,
          collectCount: 0,
          admireCount: 0,
          recommendCount: 0,
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

  it("selects the first reachable origin cover and play url from url lists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
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
                    url_list: [
                      "https://cdn.example.com/video-bad.mp4",
                      "https://cdn.example.com/video-ok.mp4",
                    ],
                  },
                  dynamic_cover: {
                    url_list: [
                      "https://cdn.example.com/dynamic-cover-bad.gif",
                      "https://cdn.example.com/dynamic-cover-ok.gif",
                    ],
                  },
                  origin_cover: {
                    url_list: [
                      "https://cdn.example.com/origin-cover-bad.webp",
                      "https://cdn.example.com/origin-cover-ok.webp",
                    ],
                  },
                },
                create_time: 1712102400,
                statistics: {
                  play_count: 100,
                  digg_count: 10,
                  comment_count: 1,
                  share_count: 2,
                  collect_count: 3,
                  admire_count: 4,
                  recommend_count: 5,
                },
              },
            ],
            has_more: 0,
            max_cursor: 99,
          },
        }),
      })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { crawlerService } = await import("@/server/services/crawler.service");
    const result = await crawlerService.fetchVideoList("sec_123", 50);

    expect(result.videos[0]).toMatchObject({
      awemeId: "video_1",
      coverSourceUrl: "https://cdn.example.com/origin-cover-ok.webp",
      videoSourceUrl: "https://cdn.example.com/video-ok.mp4",
      collectCount: 3,
      admireCount: 4,
      recommendCount: 5,
    });
  });

  it("resolves share_info.share_url and replaces the %s placeholder for video list items", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 200,
          data: {
            aweme_list: [
              {
                aweme_id: "video_share_1",
                desc: "分享视频",
                share_info: {
                  share_url:
                    "https://crawler.example.com/share?aweme_id=video_share_1",
                  share_link_desc:
                    "9.74 k@p.Dh sRK:/ 11/07 长阴杀跌加速赶底，恐慌中静待“黄金坑” %s 复制此链接，打开Dou音搜索，直接观看视频！",
                },
                statistics: {
                  play_count: 100,
                  digg_count: 10,
                  comment_count: 1,
                  share_count: 2,
                },
              },
            ],
            has_more: 0,
            max_cursor: 0,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: "success",
          now: 1775490631,
          data: "https://v.douyin.com/rgyF09XQn84/",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { crawlerService } = await import("@/server/services/crawler.service");
    const result = await crawlerService.fetchVideoList("sec_123", 0, 1);

    expect(result.videos[0]?.shareUrl).toBe(
      "9.74 k@p.Dh sRK:/ 11/07 长阴杀跌加速赶底，恐慌中静待“黄金坑” https://v.douyin.com/rgyF09XQn84/ 复制此链接，打开Dou音搜索，直接观看视频！",
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://www.douyin.com/aweme/v1/web/web_shorten/?target=https%3A%2F%2Fcrawler.example.com%2Fshare%3Faweme_id%3Dvideo_share_1",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("maps collection videos into structured items", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          aweme_list: [
            {
              aweme_id: "fav_1",
              collect_time: 1712102400,
              author: {
                sec_user_id: "author_sec_1",
              },
            },
            {
              awemeId: "fav_2",
              favorited_time: "1712106000",
              author_info: {
                sec_uid: "author_sec_2",
              },
            },
          ],
          has_more: 1,
          max_cursor: 88,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { crawlerService } = await import("@/server/services/crawler.service");
    const result = await crawlerService.fetchCollectionVideos({
      cookieHeader: "sessionid=abc123",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/douyin/web/fetch_user_collection_videos?cookie=sessionid%3Dabc123&max_cursor=0&count=30",
      ),
      expect.objectContaining({
        method: "GET",
        headers: undefined,
      }),
    );

    expect(result).toEqual({
      items: [
        {
          awemeId: "fav_1",
          authorSecUserId: "author_sec_1",
          collectedAt: new Date("2024-04-03T00:00:00.000Z"),
        },
        {
          awemeId: "fav_2",
          authorSecUserId: "author_sec_2",
          collectedAt: new Date("2024-04-03T01:00:00.000Z"),
        },
      ],
      hasMore: true,
      cursor: 88,
    });
  });

  it("does not treat video create_time as collection time", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          aweme_list: [
            {
              aweme_id: "fav_3",
              create_time: 1712102400,
              author: {
                sec_user_id: "author_sec_3",
              },
            },
          ],
          has_more: 0,
          cursor: 0,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { crawlerService } = await import("@/server/services/crawler.service");
    const result = await crawlerService.fetchCollectionVideos({
      cookieHeader: "sessionid=abc123",
    });

    expect(result.items).toEqual([
      {
        awemeId: "fav_3",
        authorSecUserId: "author_sec_3",
        collectedAt: null,
      },
    ]);
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
      shareUrl: null,
      playCount: 200,
      likeCount: 20,
      commentCount: 3,
      shareCount: 4,
    });
  });

  it("resolves share_info.share_url and replaces the %s placeholder for single video detail", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 200,
          data: {
            aweme_detail: {
              aweme_id: "video_1",
              share_info: {
                share_url:
                  "https://crawler.example.com/share?aweme_id=video_1",
                share_link_desc:
                  "3.84 T@l.PK Okc:/ 02/24 连续反弹后要补缺，接下来谁是香饽饽？ %s 复制此链接，打开Dou音搜索，直接观看视频！",
              },
              statistics: {
                play_count: 200,
                digg_count: 20,
                comment_count: 3,
                share_count: 4,
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: "success",
          now: 1775490631,
          data: "https://v.douyin.com/rgyF09XQn84/",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { crawlerService } = await import("@/server/services/crawler.service");
    const result = await crawlerService.fetchOneVideo("video_1");

    expect(result).toEqual({
      awemeId: "video_1",
      shareUrl:
        "3.84 T@l.PK Okc:/ 02/24 连续反弹后要补缺，接下来谁是香饽饽？ https://v.douyin.com/rgyF09XQn84/ 复制此链接，打开Dou音搜索，直接观看视频！",
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
