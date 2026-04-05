import {
  BenchmarkAccountMemberSource,
  DouyinAccountLoginStatus,
  Prisma,
  type DouyinAccount,
} from "@prisma/client";

import { AppError } from "@/lib/errors";
import { benchmarkAccountRepository } from "@/server/repositories/benchmark-account.repository";
import { benchmarkVideoRepository } from "@/server/repositories/benchmark-video.repository";
import { benchmarkVideoSnapshotRepository } from "@/server/repositories/benchmark-video-snapshot.repository";
import { douyinAccountRepository } from "@/server/repositories/douyin-account.repository";
import { douyinVideoRepository } from "@/server/repositories/douyin-video.repository";
import { employeeCollectionVideoRepository } from "@/server/repositories/employee-collection-video.repository";
import { videoSnapshotRepository } from "@/server/repositories/video-snapshot.repository";
import { crawlerService } from "@/server/services/crawler.service";
import { storageService } from "@/server/services/storage.service";

const INITIAL_SYNC_LIMIT = 10;
const INCREMENTAL_BATCH_SIZE = 5;
const MAX_INCREMENTAL_BATCHES = 10;
const COLLECTION_BATCH_SIZE = 30;
const RECENT_VIDEO_WINDOW_MS = 24 * 60 * 60 * 1000;
const MID_TERM_VIDEO_WINDOW_MS = 72 * 60 * 60 * 1000;
const MID_TERM_VIDEO_SYNC_INTERVAL_MS = 60 * 60 * 1000;

interface SyncableAccount {
  id: string;
  profileUrl: string;
  secUserId: string | null;
  organizationId: string;
}

interface SyncableVideo {
  id: string;
  videoId: string;
  publishedAt: Date | null;
  collectCount: number;
  admireCount: number;
  recommendCount: number;
  snapshots: Array<{
    timestamp: Date;
  }>;
}

interface CrawlerProfile {
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

interface CrawlerVideo {
  awemeId: string;
  title: string;
  coverSourceUrl: string | null;
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
  videos: CrawlerVideo[];
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

interface SyncCaches {
  secUserId: Map<string, Promise<string>>;
  profile: Map<string, Promise<CrawlerProfile>>;
  videoList: Map<string, Promise<CrawlerVideoListResult>>;
  videoDetail: Map<string, Promise<CrawlerVideoDetail>>;
}

interface AccountSyncAdapter {
  label: string;
  updateSecUserId: (id: string, secUserId: string) => Promise<unknown>;
  updateAccountInfo: (
    id: string,
    data: {
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
      lastSyncedAt: Date;
    },
  ) => Promise<{ lastSyncedAt: Date | null }>;
}

interface VideoSyncAdapter {
  label: string;
  countByAccountId: (accountId: string) => Promise<number>;
  findExistingVideo: (accountId: string, videoId: string) => Promise<unknown | null>;
  updateExistingVideoStats: (
    accountId: string,
    videoId: string,
    stats: {
      playCount: number;
      likeCount: number;
      commentCount: number;
      shareCount: number;
      collectCount: number;
      admireCount: number;
      recommendCount: number;
    },
  ) => Promise<void>;
  upsertVideo: (data: {
    videoId: string;
    accountId: string;
    organizationId?: string;
    title: string;
    coverUrl: string | null;
    coverSourceUrl: string | null;
    coverStoragePath: string | null;
    videoUrl: string | null;
    videoSourceUrl: string | null;
    videoStoragePath: string | null;
    publishedAt: Date | null;
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    collectCount: number;
    admireCount: number;
    recommendCount: number;
    tags: string[];
  }) => Promise<void>;
}

interface SnapshotSyncAdapter {
  label: string;
  createSnapshot: (data: {
    videoId: string;
    playsCount: number;
    likesCount: number;
    commentsCount: number;
    sharesCount: number;
  }) => Promise<unknown>;
  updateStats: (
    id: string,
    data: {
      playCount: number;
      likeCount: number;
      commentCount: number;
      shareCount: number;
      collectCount: number;
      admireCount: number;
      recommendCount: number;
    },
  ) => Promise<unknown>;
}

class SyncService {
  async runAccountInfoBatchSync(): Promise<void> {
    const [myAccounts, benchmarkAccounts] = await Promise.all([
      douyinAccountRepository.findAll(),
      benchmarkAccountRepository.findAll(),
    ]);
    const caches = this.createCaches();

    for (const account of myAccounts) {
      try {
        await this.syncAccountInfoRecord(account, this.myAccountSyncAdapter(), caches);
      } catch (error) {
        console.error("Failed to sync my-account info:", {
          accountId: account.id,
          error,
        });
      }
    }

    for (const account of benchmarkAccounts) {
      try {
        await this.syncAccountInfoRecord(account, this.benchmarkAccountSyncAdapter(), caches);
      } catch (error) {
        console.error("Failed to sync benchmark account info:", {
          accountId: account.id,
          error,
        });
      }
    }
  }

  async runVideoBatchSync(): Promise<void> {
    const [myAccounts, benchmarkAccounts] = await Promise.all([
      douyinAccountRepository.findAll(),
      benchmarkAccountRepository.findAll(),
    ]);
    const caches = this.createCaches();

    console.log(
      `[VideoSync] 开始批量视频同步，共 ${myAccounts.length + benchmarkAccounts.length} 个账号` +
        `（MY_ACCOUNT: ${myAccounts.length}，BENCHMARK_ACCOUNT: ${benchmarkAccounts.length}）`,
    );

    for (const account of myAccounts) {
      try {
        await this.syncAccountVideosRecord(account, this.myVideoSyncAdapter(), caches);
      } catch (error) {
        console.error("Failed to sync my-account videos:", {
          accountId: account.id,
          error,
        });
      }
    }

    for (const account of benchmarkAccounts) {
      try {
        await this.syncAccountVideosRecord(account, this.benchmarkVideoSyncAdapter(), caches);
      } catch (error) {
        console.error("Failed to sync benchmark videos:", {
          accountId: account.id,
          error,
        });
      }
    }
  }

  async runVideoSnapshotCollection(): Promise<void> {
    const [myVideos, benchmarkVideos] = await Promise.all([
      douyinVideoRepository.findAllActiveForSnapshotSync(),
      benchmarkVideoRepository.findAllActiveForSnapshotSync(),
    ]);
    const caches = this.createCaches();
    const now = Date.now();

    await this.collectSnapshots(myVideos, this.mySnapshotSyncAdapter(), caches, now);
    await this.collectSnapshots(
      benchmarkVideos,
      this.benchmarkSnapshotSyncAdapter(),
      caches,
      now,
    );
  }

  async syncAccount(
    accountId: string,
    callerId: string,
    callerOrganizationId: string,
  ): Promise<{ lastSyncedAt: Date }> {
    const account = await douyinAccountRepository.findById(accountId);

    if (!account || account.organizationId !== callerOrganizationId) {
      throw new AppError("NOT_FOUND", "账号不存在", 404);
    }

    if (account.userId !== callerId) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    const caches = this.createCaches();
    const lastSyncedAt = await this.syncAccountInfoRecord(
      account,
      this.myAccountSyncAdapter(),
      caches,
    );

    try {
      await this.syncAccountVideosRecord(account, this.myVideoSyncAdapter(), caches);
    } catch (error) {
      console.error("Failed to sync douyin account videos during manual sync:", {
        accountId: account.id,
        error,
      });
    }

    return { lastSyncedAt };
  }

  async runCollectionSync(): Promise<void> {
    try {
      const accounts = await douyinAccountRepository.findAllMyAccountsForCollection();
      const caches = this.createCaches();

      console.log(`[CollectionSync] 开始，共扫描 ${accounts.length} 个员工账号`);

      for (const account of accounts) {
        try {
          if (account.loginStatus !== DouyinAccountLoginStatus.LOGGED_IN) {
            continue;
          }

          if (!account.favoriteCookieHeader) {
            await douyinAccountRepository.markLoginExpired(
              account.id,
              "账号收藏同步 Cookie 已失效，请重新登录",
            );
            continue;
          }

          const hasCollectionBaseline = await employeeCollectionVideoRepository.existsForAccount(
            account.id,
          );
          let cursor = 0;
          let shouldContinuePaging = true;

          while (shouldContinuePaging) {
            const result = await crawlerService.fetchCollectionVideos({
              cookieHeader: account.favoriteCookieHeader,
              cursor,
              count: COLLECTION_BATCH_SIZE,
            });
            let pageHitExistingCollection = false;

            for (const item of result.items) {
              if (!item.awemeId) {
                console.warn("[CollectionSync] 跳过无 awemeId 的收藏 item", {
                  accountId: account.id,
                  authorSecUserId: item.authorSecUserId,
                });
                continue;
              }

              const existingCollection = await employeeCollectionVideoRepository.existsByAccountAndAwemeId(
                account.id,
                item.awemeId,
              );

              if (hasCollectionBaseline && existingCollection) {
                pageHitExistingCollection = true;
                shouldContinuePaging = false;
                break;
              }

              await employeeCollectionVideoRepository.create({
                accountId: account.id,
                awemeId: item.awemeId,
                authorSecUserId: item.authorSecUserId,
              });

              if (!item.authorSecUserId) {
                console.warn("[CollectionSync] 跳过无 authorSecUserId 的 item", {
                  accountId: account.id,
                  awemeId: item.awemeId,
                });
                continue;
              }

              await this.ensureBenchmarkAccountMemberFromCollection(account, item.authorSecUserId, caches);
            }

            if (!hasCollectionBaseline || pageHitExistingCollection || !result.hasMore) {
              shouldContinuePaging = false;
              continue;
            }

            cursor = result.cursor;
          }
        } catch (error) {
          if (error instanceof AppError && error.code === "CRAWLER_AUTH_EXPIRED") {
            await douyinAccountRepository.markLoginExpired(
              account.id,
              "账号登录态已失效，请重新登录",
            );
            continue;
          }

          console.error("Failed to sync collection videos:", {
            accountId: account.id,
            error,
          });
        }
      }
    } catch (error) {
      console.error("Failed to run collection sync:", { error });
    }
  }

  private createCaches(): SyncCaches {
    return {
      secUserId: new Map(),
      profile: new Map(),
      videoList: new Map(),
      videoDetail: new Map(),
    };
  }

  private myAccountSyncAdapter(): AccountSyncAdapter {
    return {
      label: "MY_ACCOUNT",
      updateSecUserId: (id, secUserId) => douyinAccountRepository.updateSecUserId(id, secUserId),
      updateAccountInfo: (id, data) => douyinAccountRepository.updateAccountInfo(id, data),
    };
  }

  private benchmarkAccountSyncAdapter(): AccountSyncAdapter {
    return {
      label: "BENCHMARK_ACCOUNT",
      updateSecUserId: (id, secUserId) => benchmarkAccountRepository.updateSecUserId(id, secUserId),
      updateAccountInfo: (id, data) => benchmarkAccountRepository.updateAccountInfo(id, data),
    };
  }

  private myVideoSyncAdapter(): VideoSyncAdapter {
    return {
      label: "MY_ACCOUNT",
      countByAccountId: (accountId) => douyinVideoRepository.countByAccountId(accountId),
      findExistingVideo: (_accountId, videoId) => douyinVideoRepository.findByVideoId(videoId),
      updateExistingVideoStats: (_accountId, videoId, stats) =>
        douyinVideoRepository.updateStatsByVideoId(videoId, stats),
      upsertVideo: async (data) => {
        await douyinVideoRepository.upsertByVideoId({
          videoId: data.videoId,
          accountId: data.accountId,
          title: data.title,
          coverUrl: data.coverUrl,
          coverSourceUrl: data.coverSourceUrl,
          coverStoragePath: data.coverStoragePath,
          videoUrl: data.videoUrl,
          videoSourceUrl: data.videoSourceUrl,
          videoStoragePath: data.videoStoragePath,
          publishedAt: data.publishedAt,
          playCount: data.playCount,
          likeCount: data.likeCount,
          commentCount: data.commentCount,
          shareCount: data.shareCount,
          collectCount: data.collectCount,
          admireCount: data.admireCount,
          recommendCount: data.recommendCount,
          tags: data.tags,
        });
      },
    };
  }

  private benchmarkVideoSyncAdapter(): VideoSyncAdapter {
    return {
      label: "BENCHMARK_ACCOUNT",
      countByAccountId: (accountId) => benchmarkVideoRepository.countByAccountId(accountId),
      findExistingVideo: (accountId, videoId) =>
        benchmarkVideoRepository.findByAccountAndVideoId(accountId, videoId),
      updateExistingVideoStats: (accountId, videoId, stats) =>
        benchmarkVideoRepository.updateStatsByAccountVideoId(accountId, videoId, stats),
      upsertVideo: async (data) => {
        await benchmarkVideoRepository.upsertByVideoId({
          videoId: data.videoId,
          accountId: data.accountId,
          organizationId: data.organizationId ?? "",
          title: data.title,
          coverUrl: data.coverUrl,
          coverSourceUrl: data.coverSourceUrl,
          coverStoragePath: data.coverStoragePath,
          videoUrl: data.videoUrl,
          videoSourceUrl: data.videoSourceUrl,
          videoStoragePath: data.videoStoragePath,
          publishedAt: data.publishedAt,
          playCount: data.playCount,
          likeCount: data.likeCount,
          commentCount: data.commentCount,
          shareCount: data.shareCount,
          collectCount: data.collectCount,
          admireCount: data.admireCount,
          recommendCount: data.recommendCount,
          tags: data.tags,
        });
      },
    };
  }

  private mySnapshotSyncAdapter(): SnapshotSyncAdapter {
    return {
      label: "MY_ACCOUNT",
      createSnapshot: (data) => videoSnapshotRepository.create(data),
      updateStats: (id, data) => douyinVideoRepository.updateStats(id, data),
    };
  }

  private benchmarkSnapshotSyncAdapter(): SnapshotSyncAdapter {
    return {
      label: "BENCHMARK_ACCOUNT",
      createSnapshot: (data) => benchmarkVideoSnapshotRepository.create(data),
      updateStats: (id, data) => benchmarkVideoRepository.updateStats(id, data),
    };
  }

  private async syncAccountInfoRecord<AccountRecord extends SyncableAccount>(
    account: AccountRecord,
    adapter: AccountSyncAdapter,
    caches: SyncCaches,
  ): Promise<Date> {
    const secUserId = await this.ensureSecUserId(account, adapter.updateSecUserId, caches);
    const profile = await this.getCachedUserProfile(secUserId, caches);
    const updatedAccount = await adapter.updateAccountInfo(account.id, {
      nickname: profile.nickname,
      avatar: profile.avatar,
      bio: profile.bio,
      signature: profile.signature,
      followersCount: profile.followersCount,
      followingCount: profile.followingCount,
      likesCount: profile.likesCount,
      videosCount: profile.videosCount,
      douyinNumber: profile.douyinNumber,
      ipLocation: profile.ipLocation,
      age: profile.age,
      province: profile.province,
      city: profile.city,
      verificationLabel: profile.verificationLabel,
      verificationIconUrl: profile.verificationIconUrl,
      verificationType: profile.verificationType,
      lastSyncedAt: new Date(),
    });

    return updatedAccount.lastSyncedAt as Date;
  }

  private async syncAccountVideosRecord<AccountRecord extends SyncableAccount>(
    account: AccountRecord,
    adapter: VideoSyncAdapter,
    caches: SyncCaches,
  ): Promise<void> {
    const secUserId = await this.ensureSecUserId(
      account,
      adapter.label === "MY_ACCOUNT"
        ? this.myAccountSyncAdapter().updateSecUserId
        : this.benchmarkAccountSyncAdapter().updateSecUserId,
      caches,
    );
    const existingVideoCount = await adapter.countByAccountId(account.id);

    if (existingVideoCount === 0) {
      const result = await this.getCachedVideoList(secUserId, 0, INITIAL_SYNC_LIMIT, caches);

      for (const video of result.videos.slice(0, INITIAL_SYNC_LIMIT)) {
        await this.upsertCrawlerVideo(account, video, adapter);
      }

      return;
    }

    let cursor = 0;

    for (let batchIndex = 0; batchIndex < MAX_INCREMENTAL_BATCHES; batchIndex += 1) {
      const result = await this.getCachedVideoList(
        secUserId,
        cursor,
        INCREMENTAL_BATCH_SIZE,
        caches,
      );
      let foundExisting = false;

      for (const video of result.videos.slice(0, INCREMENTAL_BATCH_SIZE)) {
        const existing = await adapter.findExistingVideo(account.id, video.awemeId);

        if (existing) {
          foundExisting = true;
          break;
        }

        await this.upsertCrawlerVideo(account, video, adapter);
      }

      if (foundExisting || !result.hasMore) {
        break;
      }

      cursor = result.cursor;
    }
  }

  private async collectSnapshots<VideoRecord extends SyncableVideo>(
    videos: VideoRecord[],
    adapter: SnapshotSyncAdapter,
    caches: SyncCaches,
    nowMs: number,
  ): Promise<void> {
    for (const video of videos) {
      const latestSnapshotAt = video.snapshots[0]?.timestamp ?? null;
      if (!this.shouldSyncVideoSnapshot(video.publishedAt, latestSnapshotAt, nowMs)) {
        continue;
      }

      try {
        const detail = await this.getCachedVideoDetail(video.videoId, caches);

        await adapter.createSnapshot({
          videoId: video.id,
          playsCount: detail.playCount,
          likesCount: detail.likeCount,
          commentsCount: detail.commentCount,
          sharesCount: detail.shareCount,
        });

        await adapter.updateStats(video.id, {
          playCount: detail.playCount,
          likeCount: detail.likeCount,
          commentCount: detail.commentCount,
          shareCount: detail.shareCount,
          collectCount: video.collectCount,
          admireCount: video.admireCount,
          recommendCount: video.recommendCount,
        });
      } catch (error) {
        console.error("Failed to collect video snapshot:", {
          videoId: video.id,
          label: adapter.label,
          error,
        });
      }
    }
  }

  private shouldSyncVideoSnapshot(
    publishedAt: Date | null,
    lastSnapshotAt: Date | null,
    nowMs: number,
  ): boolean {
    if (!publishedAt) {
      return true;
    }

    const ageMs = nowMs - publishedAt.getTime();
    if (ageMs <= RECENT_VIDEO_WINDOW_MS) {
      return true;
    }

    if (ageMs > MID_TERM_VIDEO_WINDOW_MS) {
      return false;
    }

    if (!lastSnapshotAt) {
      return true;
    }

    return nowMs - lastSnapshotAt.getTime() >= MID_TERM_VIDEO_SYNC_INTERVAL_MS;
  }

  private async ensureSecUserId<AccountRecord extends SyncableAccount>(
    account: AccountRecord,
    updateSecUserId: (id: string, secUserId: string) => Promise<unknown>,
    caches: SyncCaches,
  ): Promise<string> {
    if (account.secUserId) {
      return account.secUserId;
    }

    const secUserId = await this.getCachedSecUserId(account.profileUrl, caches);
    await updateSecUserId(account.id, secUserId);
    account.secUserId = secUserId;

    return secUserId;
  }

  private async upsertCrawlerVideo<AccountRecord extends SyncableAccount>(
    account: AccountRecord,
    video: CrawlerVideo,
    adapter: VideoSyncAdapter,
  ): Promise<void> {
    const existing = await adapter.findExistingVideo(account.id, video.awemeId);
    if (existing) {
      await adapter.updateExistingVideoStats(account.id, video.awemeId, {
        playCount: video.playCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
        shareCount: video.shareCount,
        collectCount: video.collectCount,
        admireCount: video.admireCount,
        recommendCount: video.recommendCount,
      });
      return;
    }

    const coverStoragePath = video.coverSourceUrl
      ? await storageService.downloadAndStore(video.coverSourceUrl, "covers")
      : null;
    const videoStoragePath = video.videoSourceUrl
      ? await storageService.downloadAndStore(video.videoSourceUrl, "videos")
      : null;

    await adapter.upsertVideo({
      videoId: video.awemeId,
      accountId: account.id,
      organizationId: account.organizationId,
      title: video.title,
      coverUrl: coverStoragePath,
      coverSourceUrl: video.coverSourceUrl,
      coverStoragePath,
      videoUrl: videoStoragePath,
      videoSourceUrl: video.videoSourceUrl,
      videoStoragePath,
      publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
      playCount: video.playCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      shareCount: video.shareCount,
      collectCount: video.collectCount,
      admireCount: video.admireCount,
      recommendCount: video.recommendCount,
      tags: [],
    });
  }

  private async ensureBenchmarkAccountMemberFromCollection(
    account: DouyinAccount,
    authorSecUserId: string,
    caches: SyncCaches,
  ): Promise<void> {
    const existing = await benchmarkAccountRepository.findByOrganizationAndSecUserIdIncludingDeleted(
      account.organizationId,
      authorSecUserId,
    );

    if (existing?.deletedAt) {
      return;
    }

    if (existing) {
      await benchmarkAccountRepository.upsertMember({
        benchmarkAccountId: existing.id,
        userId: account.userId,
        organizationId: account.organizationId,
        source: BenchmarkAccountMemberSource.COLLECTION_SYNC,
      });
      return;
    }

    const profile = await this.getCachedUserProfile(authorSecUserId, caches);

    try {
      await benchmarkAccountRepository.createWithMember(
        {
          profileUrl:
            profile.secUserId
              ? `https://www.douyin.com/user/${profile.secUserId}`
              : `https://www.douyin.com/user/${authorSecUserId}`,
          secUserId: authorSecUserId,
          nickname: profile.nickname,
          avatar: profile.avatar,
          bio: profile.bio,
          signature: profile.signature,
          followersCount: profile.followersCount,
          followingCount: profile.followingCount,
          likesCount: profile.likesCount,
          videosCount: profile.videosCount,
          douyinNumber: profile.douyinNumber,
          ipLocation: profile.ipLocation,
          age: profile.age,
          province: profile.province,
          city: profile.city,
          verificationLabel: profile.verificationLabel,
          verificationIconUrl: profile.verificationIconUrl,
          verificationType: profile.verificationType,
          createdByUserId: account.userId,
          organizationId: account.organizationId,
        },
        BenchmarkAccountMemberSource.COLLECTION_SYNC,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const concurrentExisting = await benchmarkAccountRepository.findByOrganizationAndSecUserIdIncludingDeleted(
          account.organizationId,
          authorSecUserId,
        );
        if (concurrentExisting && concurrentExisting.deletedAt === null) {
          await benchmarkAccountRepository.upsertMember({
            benchmarkAccountId: concurrentExisting.id,
            userId: account.userId,
            organizationId: account.organizationId,
            source: BenchmarkAccountMemberSource.COLLECTION_SYNC,
          });
          return;
        }
      }

      throw error;
    }
  }

  private getCachedSecUserId(profileUrl: string, caches: SyncCaches): Promise<string> {
    return this.getOrCreateCacheEntry(caches.secUserId, profileUrl, () =>
      crawlerService.getSecUserId(profileUrl),
    );
  }

  private getCachedUserProfile(secUserId: string, caches: SyncCaches): Promise<CrawlerProfile> {
    return this.getOrCreateCacheEntry(caches.profile, secUserId, () =>
      crawlerService.fetchUserProfile(secUserId),
    );
  }

  private getCachedVideoList(
    secUserId: string,
    cursor: number,
    count: number,
    caches: SyncCaches,
  ): Promise<CrawlerVideoListResult> {
    return this.getOrCreateCacheEntry(caches.videoList, `${secUserId}:${cursor}:${count}`, () =>
      crawlerService.fetchVideoList(secUserId, cursor, count),
    );
  }

  private getCachedVideoDetail(videoId: string, caches: SyncCaches): Promise<CrawlerVideoDetail> {
    return this.getOrCreateCacheEntry(caches.videoDetail, videoId, () =>
      crawlerService.fetchOneVideo(videoId),
    );
  }

  private getOrCreateCacheEntry<T>(
    cache: Map<string, Promise<T>>,
    key: string,
    factory: () => Promise<T>,
  ): Promise<T> {
    const existing = cache.get(key);
    if (existing) {
      return existing;
    }

    const created = factory().catch((error) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, created);
    return created;
  }
}

export const syncService = new SyncService();

