import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

interface CrawlerResponse<T> {
  code: number;
  router?: string;
  data: T;
}

interface CrawlerUserProfile {
  secUserId: string;
  nickname: string;
  avatar: string;
  bio: string | null;
  followersCount: number;
  videosCount: number;
}

interface CrawlerVideoItem {
  awemeId: string;
  title: string;
  coverUrl: string | null;
  videoUrl: string | null;
  publishedAt: string | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

interface CrawlerVideoListResult {
  videos: CrawlerVideoItem[];
  hasMore: boolean;
  cursor: number;
}

interface CrawlerVideoDetail {
  awemeId: string;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

type CrawlerCollectionResult = Record<string, unknown>;

type UnknownRecord = Record<string, unknown>;

class CrawlerService {
  async getSecUserId(url: string): Promise<string> {
    const raw = await this.callCrawlerApi<UnknownRecord>(
      "/api/douyin/web/get_sec_user_id",
      { url },
    );

    const secUserId = this.pickString(raw, ["sec_user_id", "secUid", "sec_uid"]);
    if (!secUserId) {
      throw new AppError("CRAWLER_ERROR", "爬虫返回的 secUserId 无效", 502);
    }

    return secUserId;
  }

  async fetchUserProfile(secUserId: string): Promise<CrawlerUserProfile> {
    const raw = await this.callCrawlerApi<UnknownRecord>(
      "/api/douyin/web/handler_user_profile",
      { sec_user_id: secUserId },
    );
    const user = this.pickRecord(raw, ["user", "user_info"]) ?? raw;

    return {
      secUserId:
        this.pickString(user, ["sec_user_id", "sec_uid"]) ??
        this.pickString(raw, ["sec_user_id", "sec_uid"]) ??
        secUserId,
      nickname: this.pickString(user, ["nickname"]) ?? "",
      avatar:
        this.pickFirstUrl(user, [
          "avatar_larger",
          "avatar_medium",
          "avatar_thumb",
          "avatar",
        ]) ?? "",
      bio: this.pickString(user, ["signature", "bio"]) ?? null,
      followersCount: this.pickNumber(user, ["follower_count", "followers_count"]) ?? 0,
      videosCount: this.pickNumber(user, ["aweme_count", "video_count", "videos_count"]) ?? 0,
    };
  }

  async fetchVideoList(
    secUserId: string,
    cursor: number = 0,
    count: number = 35,
  ): Promise<CrawlerVideoListResult> {
    const raw = await this.callCrawlerApi<UnknownRecord>(
      "/api/douyin/web/fetch_user_post_videos",
      {
        sec_user_id: secUserId,
        max_cursor: cursor,
        count,
      },
    );

    const rawVideos = this.pickArray(raw, ["aweme_list", "videos", "video_list"]);
    const videos = rawVideos.map((item) => this.mapVideoItem(item));

    return {
      videos,
      hasMore: this.pickBoolean(raw, ["has_more"]) ?? false,
      cursor: this.pickNumber(raw, ["max_cursor", "cursor"]) ?? 0,
    };
  }

  async fetchCollectionVideos(secUserId: string): Promise<CrawlerCollectionResult> {
    return this.callCrawlerApi<CrawlerCollectionResult>(
      "/api/douyin/web/fetch_user_collection_videos",
      { sec_user_id: secUserId },
    );
  }

  async fetchOneVideo(awemeId: string): Promise<CrawlerVideoDetail> {
    const raw = await this.callCrawlerApi<UnknownRecord>(
      "/api/douyin/web/fetch_one_video",
      { aweme_id: awemeId },
    );
    const detail = this.pickRecord(raw, ["aweme_detail", "aweme", "video"]) ?? raw;
    const statistics = this.pickRecord(detail, ["statistics", "stats"]) ?? detail;

    return {
      awemeId:
        this.pickString(detail, ["aweme_id", "awemeId", "video_id"]) ??
        this.pickString(raw, ["aweme_id", "awemeId"]) ??
        awemeId,
      playCount: this.pickNumber(statistics, ["play_count", "playCount"]) ?? 0,
      likeCount: this.pickNumber(statistics, ["digg_count", "like_count", "likeCount"]) ?? 0,
      commentCount:
        this.pickNumber(statistics, ["comment_count", "commentCount"]) ?? 0,
      shareCount: this.pickNumber(statistics, ["share_count", "shareCount"]) ?? 0,
    };
  }

  private async callCrawlerApi<T>(
    path: string,
    params: Record<string, string | number>,
  ): Promise<T> {
    if (!env.CRAWLER_API_URL) {
      throw new AppError("CRAWLER_ERROR", "未配置 CRAWLER_API_URL", 502);
    }

    const maxRetries = 2;
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      searchParams.set(key, String(value));
    }

    const url = `${env.CRAWLER_API_URL}${path}?${searchParams.toString()}`;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: "GET",
          signal: AbortSignal.timeout(30_000),
        });

        if (!response.ok) {
          throw new Error(`Crawler API error: ${response.status}`);
        }

        const rawJson = (await response.json()) as CrawlerResponse<T>;
        console.info(`[CrawlerService] ${path} response:`, JSON.stringify(rawJson));
        return rawJson.data;
      } catch {
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw new AppError("CRAWLER_ERROR", "爬虫服务调用失败，请稍后重试", 502);
  }

  private mapVideoItem(rawVideo: unknown): CrawlerVideoItem {
    const video = this.asRecord(rawVideo);
    const statistics = this.pickRecord(video, ["statistics", "stats"]) ?? {};
    const videoAsset = this.pickRecord(video, ["video"]) ?? video;

    const coverUrl = this.pickFirstUrl(videoAsset, ["cover", "origin_cover", "dynamic_cover"]);
    const videoUrl = this.pickFirstUrl(videoAsset, ["play_addr", "download_addr"]);

    if (coverUrl) {
      console.info(`[CrawlerService] 待下载封面: ${coverUrl}`);
    }

    if (videoUrl) {
      console.info(`[CrawlerService] 待下载视频: ${videoUrl}`);
    }

    return {
      awemeId: this.pickString(video, ["aweme_id", "awemeId", "video_id"]) ?? "",
      title: this.pickString(video, ["desc", "title"]) ?? "",
      coverUrl,
      videoUrl,
      publishedAt: this.mapTimestamp(this.pickUnknown(video, ["create_time", "published_at"])),
      playCount: this.pickNumber(statistics, ["play_count", "playCount"]) ?? 0,
      likeCount: this.pickNumber(statistics, ["digg_count", "like_count", "likeCount"]) ?? 0,
      commentCount:
        this.pickNumber(statistics, ["comment_count", "commentCount"]) ?? 0,
      shareCount: this.pickNumber(statistics, ["share_count", "shareCount"]) ?? 0,
    };
  }

  private mapTimestamp(value: unknown): string | null {
    if (typeof value === "number") {
      return new Date(value * 1000).toISOString();
    }

    if (typeof value === "string" && value.length > 0) {
      return /^\d+$/.test(value)
        ? new Date(Number(value) * 1000).toISOString()
        : new Date(value).toISOString();
    }

    return null;
  }

  private asRecord(value: unknown): UnknownRecord {
    return value && typeof value === "object" ? (value as UnknownRecord) : {};
  }

  private pickUnknown(record: UnknownRecord, keys: string[]): unknown {
    for (const key of keys) {
      if (key in record) {
        return record[key];
      }
    }

    return undefined;
  }

  private pickRecord(record: UnknownRecord, keys: string[]): UnknownRecord | null {
    const value = this.pickUnknown(record, keys);
    return value && typeof value === "object" ? (value as UnknownRecord) : null;
  }

  private pickArray(record: UnknownRecord, keys: string[]): unknown[] {
    const value = this.pickUnknown(record, keys);
    return Array.isArray(value) ? value : [];
  }

  private pickString(record: UnknownRecord, keys: string[]): string | null {
    const value = this.pickUnknown(record, keys);
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private pickNumber(record: UnknownRecord, keys: string[]): number | null {
    const value = this.pickUnknown(record, keys);

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string" && value.length > 0 && !Number.isNaN(Number(value))) {
      return Number(value);
    }

    return null;
  }

  private pickBoolean(record: UnknownRecord, keys: string[]): boolean | null {
    const value = this.pickUnknown(record, keys);

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    return null;
  }

  private pickFirstUrl(record: UnknownRecord, keys: string[]): string | null {
    for (const key of keys) {
      const value = this.pickUnknown(record, [key]);

      if (typeof value === "string" && value.length > 0) {
        return value;
      }

      if (value && typeof value === "object") {
        const urlList = (value as { url_list?: unknown }).url_list;
        if (Array.isArray(urlList)) {
          const firstUrl = urlList.find(
            (item): item is string => typeof item === "string" && item.length > 0,
          );
          if (firstUrl) {
            return firstUrl;
          }
        }
      }
    }

    return null;
  }
}

export const crawlerService = new CrawlerService();
