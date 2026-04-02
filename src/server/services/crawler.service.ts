import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { AccountPreview } from "@/types/douyin-account";

class CrawlerService {
  async fetchDouyinProfile(profileUrl: string): Promise<AccountPreview> {
    if (env.NODE_ENV === "development" && !env.CRAWLER_API_URL) {
      return this.mockProfile(profileUrl);
    }

    return this.callCrawlerApi<AccountPreview>("/douyin/user/profile", { profileUrl });
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
