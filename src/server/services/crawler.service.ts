import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { decryptCookieValue } from "@/lib/crypto";
import { getSharedRedisClient } from "@/lib/redis";
import { crawlerCookieRepository } from "@/server/repositories/crawler-cookie.repository";

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
  signature: string | null;
  followersCount: number;
  followingCount: number;
  likesCount: number;
  videosCount: number;
  douyinNumber: string | null;
  ipLocation: string | null;
  age: number | null;
  province: string | null;
  city: string | null;
  verificationLabel: string | null;
  verificationIconUrl: string | null;
  verificationType: number | null;
}

interface CrawlerVideoItem {
  awemeId: string;
  title: string;
  shareUrl: string | null;
  coverUrl: string | null;
  coverSourceUrl: string | null;
  videoUrl: string | null;
  videoSourceUrl: string | null;
  publishedAt: string | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  collectCount: number;
  admireCount: number;
  recommendCount: number;
}

interface CrawlerVideoListResult {
  videos: CrawlerVideoItem[];
  hasMore: boolean;
  cursor: number;
}

interface CrawlerVideoDetail {
  awemeId: string;
  shareUrl: string | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

interface CrawlerCollectionItem {
  awemeId: string | null;
  authorSecUserId: string | null;
  collectedAt: Date | null;
}

interface CrawlerCollectionResult {
  items: CrawlerCollectionItem[];
  hasMore: boolean;
  cursor: number;
}

interface FetchCollectionVideosInput {
  cookieHeader: string;
  cursor?: number;
  count?: number;
}

interface ShareResolveRequestOptions {
  cookieHeader?: string | null;
  referer?: string | null;
}

type UnknownRecord = Record<string, unknown>;

class CrawlerService {
  async getSecUserId(url: string, organizationId?: string): Promise<string> {
    const raw = await this.callCrawlerApi<unknown>(
      "/api/douyin/web/get_sec_user_id",
      { url },
      { organizationId },
    );

    if (typeof raw === "string" && raw.length > 0) {
      return raw;
    }

    const secUserId = this.pickString(raw, ["sec_user_id", "secUid", "sec_uid"]);
    if (!secUserId) {
      throw new AppError("CRAWLER_ERROR", "爬虫返回的 secUserId 无效", 502);
    }

    return secUserId;
  }

  async fetchUserProfile(secUserId: string, organizationId?: string): Promise<CrawlerUserProfile> {
    const raw = await this.callCrawlerApi<UnknownRecord>(
      "/api/douyin/web/handler_user_profile",
      { sec_user_id: secUserId },
      { organizationId },
    );
    const user = this.pickRecord(raw, ["user", "user_info"]) ?? raw;
    const firstEndorsement = this.pickFirstRecord(user, ["endorsement_info_list"]);
    const accountCertInfo = this.parseJsonRecord(this.pickString(user, ["account_cert_info"]));
    const signature = this.pickString(user, ["signature", "bio"]) ?? null;

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
      bio: signature,
      signature,
      followersCount: this.pickNumber(user, ["follower_count", "followers_count"]) ?? 0,
      followingCount: this.pickNumber(user, ["following_count", "follow_count"]) ?? 0,
      likesCount: this.pickNumber(user, ["total_favorited", "favoriting_count"]) ?? 0,
      videosCount: this.pickNumber(user, ["aweme_count", "video_count", "videos_count"]) ?? 0,
      douyinNumber:
        this.pickString(user, ["unique_id"]) ??
        this.pickString(user, ["short_id"]) ??
        null,
      ipLocation: this.pickString(user, ["ip_location"]) ?? null,
      age: this.pickNumber(user, ["user_age"]) ?? null,
      province: this.pickString(user, ["province"]) ?? null,
      city: this.pickString(user, ["city"]) ?? null,
      verificationLabel:
        this.pickString(firstEndorsement, ["text"]) ??
        this.pickString(accountCertInfo, ["label_text"]) ??
        null,
      verificationIconUrl:
        this.pickString(firstEndorsement, ["light_icon_url"]) ??
        this.pickString(firstEndorsement, ["dark_icon_url"]) ??
        null,
      verificationType: this.pickNumber(user, ["verification_type"]) ?? null,
    };
  }

  async fetchVideoList(
    secUserId: string,
    cursor: number = 0,
    count: number = 35,
    options: ShareResolveRequestOptions = {},
    organizationId?: string,
  ): Promise<CrawlerVideoListResult> {
    const raw = await this.callCrawlerApi<UnknownRecord>(
      "/api/douyin/web/fetch_user_post_videos",
      {
        sec_user_id: secUserId,
        max_cursor: cursor,
        count,
      },
      { organizationId },
    );

    const rawVideos = this.pickArray(raw, ["aweme_list", "videos", "video_list"]);
    const videos = await Promise.all(rawVideos.map((item) => this.mapVideoItem(item, options)));

    return {
      videos,
      hasMore: this.pickBoolean(raw, ["has_more"]) ?? false,
      cursor: this.pickNumber(raw, ["max_cursor", "cursor"]) ?? 0,
    };
  }

  async fetchCollectionVideos(
    input: FetchCollectionVideosInput,
    organizationId?: string,
  ): Promise<CrawlerCollectionResult> {
    const raw = await this.callCrawlerApi<UnknownRecord>(
      "/api/douyin/web/fetch_user_collection_videos",
      {
        cookie: input.cookieHeader,
        max_cursor: input.cursor ?? 0,
        count: input.count ?? 30,
      },
      { authSensitive: true, organizationId },
    );
    const items = this.pickArray(raw, ["aweme_list", "collect_list", "video_list"]).map((item) => {
      const author = this.pickRecord(item, ["author", "author_info"]) ?? {};
      const collectedAtTimestamp = this.pickNumber(item, [
        "collect_time",
        "favorited_time",
      ]);

      return {
        awemeId: this.pickString(item, ["aweme_id", "awemeId"]),
        authorSecUserId: this.pickString(author, ["sec_user_id", "sec_uid"]),
        collectedAt: collectedAtTimestamp ? new Date(collectedAtTimestamp * 1000) : null,
      };
    });

    return {
      items,
      hasMore: this.pickBoolean(raw, ["has_more"]) ?? false,
      cursor: this.pickNumber(raw, ["max_cursor", "cursor"]) ?? 0,
    };
  }

  async fetchOneVideo(
    awemeId: string,
    options: ShareResolveRequestOptions = {},
    organizationId?: string,
  ): Promise<CrawlerVideoDetail> {
    const raw = await this.callCrawlerApi<UnknownRecord>(
      "/api/douyin/web/fetch_one_video",
      { aweme_id: awemeId },
      { organizationId },
    );
    const detail = this.pickRecord(raw, ["aweme_detail", "aweme", "video"]) ?? raw;
    const statistics = this.pickRecord(detail, ["statistics", "stats"]) ?? detail;
    const shareUrl = await this.resolveShareUrl(detail, {
      ...options,
      referer: options.referer ?? `https://www.douyin.com/video/${awemeId}`,
    });

    return {
      awemeId:
        this.pickString(detail, ["aweme_id", "awemeId", "video_id"]) ??
        this.pickString(raw, ["aweme_id", "awemeId"]) ??
        awemeId,
      shareUrl,
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
    options: {
      authSensitive?: boolean;
      requestHeaders?: HeadersInit;
      organizationId?: string;
    } = {},
  ): Promise<T> {
    if (!env.CRAWLER_API_URL) {
      throw new AppError("CRAWLER_ERROR", "未配置 CRAWLER_API_URL", 502);
    }

    if (options.organizationId) {
      await this.maybeRotateCookie(options.organizationId);
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
          headers: options.requestHeaders,
          signal: AbortSignal.timeout(30_000),
        });

        let responseText = "";

        if (!response.ok) {
          responseText = await response.text().catch(() => "");
          console.error("[CrawlerService] crawler http error", {
            path,
            url,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            httpStatus: response.status,
            responseText,
          });
          if (options.authSensitive && [401, 403].includes(response.status)) {
            throw new AppError("CRAWLER_AUTH_EXPIRED", "账号登录态已失效，请重新登录", 502);
          }

          throw new Error(`Crawler API error: ${response.status}`);
        }

        const rawJson = (await response.json()) as CrawlerResponse<T>;
        if (options.authSensitive && [401, 403].includes(rawJson.code)) {
          console.error("[CrawlerService] crawler auth-sensitive business error", {
            path,
            url,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            code: rawJson.code,
            router: rawJson.router ?? null,
            rawJsonText: JSON.stringify(rawJson),
          });
          throw new AppError("CRAWLER_AUTH_EXPIRED", "账号登录态已失效，请重新登录", 502);
        }

        return rawJson.data;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        console.error("[CrawlerService] crawler request attempt failed", {
          path,
          url,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw new AppError("CRAWLER_ERROR", "爬虫服务调用失败，请稍后重试", 502);
  }

  private async mapVideoItem(
    rawVideo: unknown,
    options: ShareResolveRequestOptions = {},
  ): Promise<CrawlerVideoItem> {
    const video = this.asRecord(rawVideo);
    const statistics = this.pickRecord(video, ["statistics", "stats"]) ?? {};
    const videoAsset = this.pickRecord(video, ["video"]) ?? video;
    const awemeId = this.pickString(video, ["aweme_id", "awemeId", "video_id"]) ?? "";
    const shareUrl = await this.resolveShareUrl(video, {
      ...options,
      referer: options.referer ?? (awemeId ? `https://www.douyin.com/video/${awemeId}` : null),
    });
    const coverCandidates = this.pickNestedUrlList(videoAsset, [
      ["cover", "origin_cover"],
      ["origin_cover"],
      ["cover", "dynamic_cover"],
      ["dynamic_cover"],
      ["cover"],
    ]);
    const videoCandidates = this.pickNestedUrlList(videoAsset, [
      ["play_addr"],
      ["download_addr"],
    ]);

    const coverSourceUrl = await this.pickReachableUrl(coverCandidates);
    const videoSourceUrl = await this.pickReachableUrl(videoCandidates);

    if (coverSourceUrl) {
      console.info(`[CrawlerService] 待下载封面: ${coverSourceUrl}`);
    }

    if (videoSourceUrl) {
      console.info(`[CrawlerService] 待下载视频: ${videoSourceUrl}`);
    }

    return {
      awemeId,
      title: this.pickString(video, ["desc", "title"]) ?? "",
      shareUrl,
      coverUrl: null,
      coverSourceUrl,
      videoUrl: null,
      videoSourceUrl,
      publishedAt: this.mapTimestamp(this.pickUnknown(video, ["create_time", "published_at"])),
      playCount: this.pickNumber(statistics, ["play_count", "playCount"]) ?? 0,
      likeCount: this.pickNumber(statistics, ["digg_count", "like_count", "likeCount"]) ?? 0,
      commentCount:
        this.pickNumber(statistics, ["comment_count", "commentCount"]) ?? 0,
      shareCount: this.pickNumber(statistics, ["share_count", "shareCount"]) ?? 0,
      collectCount: this.pickNumber(statistics, ["collect_count", "collectCount"]) ?? 0,
      admireCount: this.pickNumber(statistics, ["admire_count", "admireCount"]) ?? 0,
      recommendCount: this.pickNumber(statistics, ["recommend_count", "recommendCount"]) ?? 0,
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

  private pickUnknown(record: unknown, keys: string[]): unknown {
    if (!record || typeof record !== "object") {
      return undefined;
    }

    const source = record as UnknownRecord;
    for (const key of keys) {
      if (key in source) {
        return source[key];
      }
    }

    return undefined;
  }

  private pickRecord(record: unknown, keys: string[]): UnknownRecord | null {
    const value = this.pickUnknown(record, keys);
    return value && typeof value === "object" ? (value as UnknownRecord) : null;
  }

  private pickFirstRecord(record: unknown, keys: string[]): UnknownRecord | null {
    const value = this.pickUnknown(record, keys);

    if (!Array.isArray(value)) {
      return null;
    }

    const firstRecord = value.find(
      (item): item is UnknownRecord => Boolean(item) && typeof item === "object",
    );

    return firstRecord ?? null;
  }

  private pickArray(record: unknown, keys: string[]): unknown[] {
    const value = this.pickUnknown(record, keys);
    return Array.isArray(value) ? value : [];
  }

  private pickString(record: unknown, keys: string[]): string | null {
    const value = this.pickUnknown(record, keys);
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private pickNumber(record: unknown, keys: string[]): number | null {
    const value = this.pickUnknown(record, keys);

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string" && value.length > 0 && !Number.isNaN(Number(value))) {
      return Number(value);
    }

    return null;
  }

  private pickBoolean(record: unknown, keys: string[]): boolean | null {
    const value = this.pickUnknown(record, keys);

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    return null;
  }

  private pickFirstUrl(record: unknown, keys: string[]): string | null {
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

  private pickNestedUrlList(record: unknown, paths: string[][]): string[] {
    for (const path of paths) {
      let current: unknown = record;

      for (const key of path) {
        current = this.pickUnknown(current, [key]);
        if (current === undefined) {
          break;
        }
      }

      if (Array.isArray(current)) {
        const urls = current.filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        );
        if (urls.length > 0) {
          return urls;
        }
      }

      if (current && typeof current === "object") {
        const urlList = (current as { url_list?: unknown }).url_list;
        if (Array.isArray(urlList)) {
          const urls = urlList.filter(
            (item): item is string => typeof item === "string" && item.length > 0,
          );
          if (urls.length > 0) {
            return urls;
          }
        }
      }
    }

    return [];
  }

  private async pickReachableUrl(urls: string[]): Promise<string | null> {
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(10_000),
        });

        if (response.ok) {
          return url;
        }
      } catch {
        // ignore and try next url
      }
    }

    return null;
  }

  private async resolveShareUrl(
    record: unknown,
    options: ShareResolveRequestOptions = {},
  ): Promise<string | null> {
    const shareInfo = this.pickRecord(record, ["share_info"]);
    const shareRequestUrl =
      this.pickString(record, ["share_info_share_url"]) ??
      this.pickString(shareInfo, ["share_url"]);
    const shareLinkDesc =
      this.pickString(record, ["share_info_share_link_desc"]) ??
      this.pickString(shareInfo, ["share_link_desc"]);

    if (shareRequestUrl) {
      const shortShareUrl = await this.fetchResolvedShareLink(shareRequestUrl, options);
      if (shareLinkDesc && shortShareUrl) {
        return shareLinkDesc.replace("%s", shortShareUrl);
      }

      return shortShareUrl ?? shareLinkDesc;
    }

    return shareLinkDesc ?? this.pickString(record, ["share_url"]);
  }

  private async fetchResolvedShareLink(
    url: string,
    options: ShareResolveRequestOptions = {},
  ): Promise<string | null> {
    try {
      const shortenUrl =
        `https://www.douyin.com/aweme/v1/web/web_shorten/?target=${encodeURIComponent(url)}`;
      const response = await fetch(shortenUrl, {
        method: "GET",
        headers: {
          accept: "application/json,text/plain,*/*",
          ...(options.cookieHeader ? { cookie: options.cookieHeader } : {}),
          ...(options.referer ? { referer: options.referer } : {}),
          "user-agent": "Mozilla/5.0",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        return null;
      }

      const rawJson = (await response.json().catch(() => null)) as
        | { code?: unknown; data?: unknown }
        | null;

      if (typeof rawJson?.data === "string" && rawJson.data.length > 0) {
        return rawJson.data;
      }

      return null;
    } catch (error) {
      console.warn("[CrawlerService] failed to resolve share url", {
        url,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private parseJsonRecord(value: string | null): UnknownRecord | null {
    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as UnknownRecord) : null;
    } catch {
      return null;
    }
  }

  /**
   * 每 5 次带 organizationId 的爬虫请求轮询切换一次 Cookie，
   * 并异步调用爬虫 update_cookie 接口同步最新 Cookie。
   */
  private async maybeRotateCookie(organizationId: string): Promise<void> {
    const redis = getSharedRedisClient();
    if (!redis) return;

    try {
      const count = await redis.incr(`crawler:cookie:counter:${organizationId}`);
      if (count % 5 !== 0) return;

      const cookies = await crawlerCookieRepository.findRawByOrganization(organizationId);
      if (cookies.length === 0) return;

      const currentPointerStr = await redis.get(`crawler:cookie:pointer:${organizationId}`);
      const parsed = parseInt(currentPointerStr ?? "0", 10);
      const currentPointer = isNaN(parsed) ? 0 : parsed;
      const nextPointer = (currentPointer + 1) % cookies.length;

      await redis.set(`crawler:cookie:pointer:${organizationId}`, String(nextPointer));

      const nextCookie = cookies[nextPointer];
      if (!nextCookie) return;
      const plainCookie = decryptCookieValue(nextCookie.value);
      void this.callUpdateCookieApi(plainCookie);
    } catch (error) {
      console.warn("[CrawlerService] maybeRotateCookie failed", {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 调用爬虫 update_cookie 接口同步 Cookie（fire-and-forget，失败只 warn）。
   */
  private async callUpdateCookieApi(cookie: string): Promise<void> {
    if (!env.CRAWLER_API_URL) {
      console.warn("[CrawlerService] callUpdateCookieApi: CRAWLER_API_URL 未配置，跳过");
      return;
    }

    try {
      await fetch(`${env.CRAWLER_API_URL}/api/hybrid/update_cookie`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: "douyin_web", cookie }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (error) {
      console.warn("[CrawlerService] update_cookie failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const crawlerService = new CrawlerService();
