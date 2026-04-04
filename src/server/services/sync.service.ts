import { Prisma, type DouyinAccount } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { douyinAccountRepository } from "@/server/repositories/douyin-account.repository";
import { douyinVideoRepository } from "@/server/repositories/douyin-video.repository";
import { videoSnapshotRepository } from "@/server/repositories/video-snapshot.repository";
import { crawlerService } from "@/server/services/crawler.service";
import { storageService } from "@/server/services/storage.service";

const INITIAL_SYNC_LIMIT = 10;
const INCREMENTAL_BATCH_SIZE = 4;
const MAX_INCREMENTAL_BATCHES = 10;

class SyncService {
  async runAccountInfoBatchSync(): Promise<void> {
    const accounts = await douyinAccountRepository.findAll();

    for (const account of accounts) {
      try {
        await this.syncAccountInfo(account);
      } catch (error) {
        console.error("Failed to sync douyin account info:", {
          accountId: account.id,
          error,
        });
      }
    }
  }

  async runVideoBatchSync(): Promise<void> {
    const accounts = await douyinAccountRepository.findAll();
    const myCount = accounts.filter((a) => a.type === "MY_ACCOUNT").length;
    const benchmarkCount = accounts.filter((a) => a.type === "BENCHMARK_ACCOUNT").length;
    console.log(
      `[VideoSync] 开始批量视频同步，共 ${accounts.length} 个账号` +
        `（MY_ACCOUNT: ${myCount}，BENCHMARK_ACCOUNT: ${benchmarkCount}）`,
    );

    for (const account of accounts) {
      try {
        await this.syncAccountVideos(account);
      } catch (error) {
        console.error("Failed to sync douyin account videos:", {
          accountId: account.id,
          error,
        });
      }
    }
  }

  async runVideoSnapshotCollection(): Promise<void> {
    const videos = await douyinVideoRepository.findAllActive();

    for (const video of videos) {
      try {
        const detail = await crawlerService.fetchOneVideo(video.videoId);

        await videoSnapshotRepository.create({
          videoId: video.id,
          playsCount: detail.playCount,
          likesCount: detail.likeCount,
          commentsCount: detail.commentCount,
          sharesCount: detail.shareCount,
        });

        await douyinVideoRepository.updateStats(video.id, {
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
          error,
        });
      }
    }
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

    const lastSyncedAt = await this.syncAccountInfo(account);

    try {
      await this.syncAccountVideos(account);
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
      const windowStart = new Date(Date.now() - 60 * 60 * 1000);

      console.log(`[CollectionSync] 开始，共扫描 ${accounts.length} 个员工账号`);

      for (const account of accounts) {
        try {
          const result = await crawlerService.fetchCollectionVideos(account.secUserId as string);

          for (const item of result.items) {
            // collectedAt 为 null（爬虫未返回字段）→ 视为状态未知，继续处理（由 findBySecUserIdIncludingDeleted 去重）
            // collectedAt 有值但早于时间窗口 → 跳过（continue，不 break，防止 API 返回乱序）
            if (item.collectedAt !== null && item.collectedAt < windowStart) {
              continue;
            }

            if (!item.authorSecUserId) {
              console.warn("[CollectionSync] 跳过无 authorSecUserId 的 item", {
                accountId: account.id,
                awemeId: item.awemeId,
              });
              continue;
            }

            const existing = await douyinAccountRepository.findBySecUserIdIncludingDeleted(
              item.authorSecUserId,
            );
            if (existing) {
              continue;
            }

            try {
              console.log(
                `[CollectionSync] 发现新博主 secUserId=${item.authorSecUserId}，准备创建 BENCHMARK_ACCOUNT`,
              );
              const profile = await crawlerService.fetchUserProfile(item.authorSecUserId);

              const created = await douyinAccountRepository.createBenchmark({
                profileUrl:
                  profile.secUserId
                    ? `https://www.douyin.com/user/${profile.secUserId}`
                    : `https://www.douyin.com/user/${item.authorSecUserId}`,
                secUserId: item.authorSecUserId,
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
                userId: account.userId,
                organizationId: account.organizationId,
              });
              console.log(
                `[CollectionSync] BENCHMARK_ACCOUNT 创建成功 secUserId=${item.authorSecUserId} id=${created.id}`,
              );
            } catch (error) {
              if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002"
              ) {
                console.log(
                  `[CollectionSync] secUserId=${item.authorSecUserId} 已存在（并发写冲突），跳过`,
                );
                continue;
              }

              console.error("[CollectionSync] 创建 BENCHMARK_ACCOUNT 失败", {
                accountId: account.id,
                authorSecUserId: item.authorSecUserId,
                error,
              });
            }
          }
        } catch (error) {
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

  private async syncAccountInfo(account: DouyinAccount): Promise<Date> {
    const secUserId = await this.ensureSecUserId(account);
    const profile = await crawlerService.fetchUserProfile(secUserId);
    const updatedAccount = await douyinAccountRepository.updateAccountInfo(account.id, {
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

  private async syncAccountVideos(account: DouyinAccount): Promise<void> {
    const secUserId = await this.ensureSecUserId(account);
    const existingVideoCount = await douyinVideoRepository.countByAccountId(account.id);

    if (existingVideoCount === 0) {
      const result = await crawlerService.fetchVideoList(secUserId, 0, INITIAL_SYNC_LIMIT);

      for (const video of result.videos.slice(0, INITIAL_SYNC_LIMIT)) {
        await this.upsertCrawlerVideo(account.id, video);
      }

      return;
    }

    let cursor = 0;

    for (let batchIndex = 0; batchIndex < MAX_INCREMENTAL_BATCHES; batchIndex += 1) {
      const result = await crawlerService.fetchVideoList(
        secUserId,
        cursor,
        INCREMENTAL_BATCH_SIZE,
      );
      let foundExisting = false;

      for (const video of result.videos.slice(0, INCREMENTAL_BATCH_SIZE)) {
        const existing = await douyinVideoRepository.findByVideoId(video.awemeId);

        if (existing) {
          foundExisting = true;
          break;
        }

        await this.upsertCrawlerVideo(account.id, video);
      }

      if (foundExisting || !result.hasMore) {
        break;
      }

      cursor = result.cursor;
    }
  }

  private async ensureSecUserId(account: DouyinAccount): Promise<string> {
    if (account.secUserId) {
      return account.secUserId;
    }

    const secUserId = await crawlerService.getSecUserId(account.profileUrl);
    await douyinAccountRepository.updateSecUserId(account.id, secUserId);
    account.secUserId = secUserId;

    return secUserId;
  }

  private async upsertCrawlerVideo(
    accountId: string,
    video: {
      awemeId: string;
      title: string;
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
    },
  ): Promise<void> {
    // 预检查：已存在则仅更新数据指标，不重新下载文件
    const existing = await douyinVideoRepository.findByVideoId(video.awemeId);
    if (existing) {
      await douyinVideoRepository.updateStatsByVideoId(video.awemeId, {
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

    // 不存在：正常下载文件并创建记录
    const coverStoragePath = video.coverSourceUrl
      ? await storageService.downloadAndStore(video.coverSourceUrl, "covers")
      : null;
    const videoStoragePath = video.videoSourceUrl
      ? await storageService.downloadAndStore(video.videoSourceUrl, "videos")
      : null;

    await douyinVideoRepository.upsertByVideoId({
      videoId: video.awemeId,
      accountId,
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
}

export const syncService = new SyncService();
