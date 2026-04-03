import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { AccountPreview } from "@/types/douyin-account";

interface VideoFromCrawler {
  videoId: string;
  title: string;
  coverUrl: string | null;
  videoUrl: string | null;
  publishedAt: string | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

interface FetchVideosResult {
  videos: VideoFromCrawler[];
  hasMore: boolean;
}

class CrawlerService {
  async fetchDouyinProfile(profileUrl: string): Promise<AccountPreview> {
    if (env.NODE_ENV === "development" && !env.CRAWLER_API_URL) {
      return this.mockProfile(profileUrl);
    }

    return this.callCrawlerApi<AccountPreview>("/douyin/user/profile", { profileUrl });
  }

  async fetchDouyinVideos(profileUrl: string, page: number): Promise<FetchVideosResult> {
    if (env.NODE_ENV === "development" && !env.CRAWLER_API_URL) {
      return this.mockVideos(profileUrl, page);
    }

    return this.callCrawlerApi<FetchVideosResult>("/douyin/user/videos", {
      profileUrl,
      page,
    });
  }

  private mockProfile(profileUrl: string): AccountPreview {
    const slug = profileUrl.split("/").pop() ?? "mock";

    return {
      profileUrl,
      nickname: `模拟账号_${slug}`,
      avatar: "https://p3-sign.douyinpic.com/mock-avatar.jpg",
      bio: "这是一个模拟账号的简介",
      followersCount: Math.floor(Math.random() * 100_000),
      videosCount: Math.floor(Math.random() * 500),
    };
  }

  private mockVideos(profileUrl: string, page: number): FetchVideosResult {
    if (page > 1) {
      return {
        videos: [],
        hasMore: false,
      };
    }

    const slug = profileUrl.split("/").pop() ?? "mock";
    const videos: VideoFromCrawler[] = Array.from({ length: 8 }, (_, index) => ({
      videoId: `mock_${slug}_${index}`,
      title: `模拟视频 ${index + 1} - ${slug}`,
      coverUrl: null,
      videoUrl: null,
      publishedAt: new Date(Date.now() - index * 86400000).toISOString(),
      playCount: Math.floor(Math.random() * 10000),
      likeCount: Math.floor(Math.random() * 1000),
      commentCount: Math.floor(Math.random() * 100),
      shareCount: Math.floor(Math.random() * 50),
    }));

    return {
      videos,
      hasMore: false,
    };
  }

  private async callCrawlerApi<T>(path: string, payload: unknown): Promise<T> {
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await fetch(`${env.CRAWLER_API_URL}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Crawler API error: ${response.status}`);
        }

        return (await response.json()) as T;
      } catch {
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw new AppError("CRAWLER_ERROR", "爬虫服务调用失败，请稍后重试", 502);
  }
}

export const crawlerService = new CrawlerService();
