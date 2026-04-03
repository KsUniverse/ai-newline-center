import type { DouyinAccount } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { douyinAccountRepository } from "@/server/repositories/douyin-account.repository";
import { douyinVideoRepository } from "@/server/repositories/douyin-video.repository";
import { crawlerService } from "@/server/services/crawler.service";

const MAX_VIDEO_PAGES = 3;

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

  private async syncAccountInfo(account: DouyinAccount): Promise<Date> {
    const profile = await crawlerService.fetchDouyinProfile(account.profileUrl);
    const updatedAccount = await douyinAccountRepository.updateAccountInfo(account.id, {
      nickname: profile.nickname,
      avatar: profile.avatar,
      bio: profile.bio,
      followersCount: profile.followersCount,
      videosCount: profile.videosCount,
      lastSyncedAt: new Date(),
    });

    return updatedAccount.lastSyncedAt as Date;
  }

  private async syncAccountVideos(account: DouyinAccount): Promise<void> {
    for (let page = 1; page <= MAX_VIDEO_PAGES; page += 1) {
      const result = await crawlerService.fetchDouyinVideos(account.profileUrl, page);

      for (const video of result.videos) {
        await douyinVideoRepository.upsertByVideoId({
          videoId: video.videoId,
          accountId: account.id,
          title: video.title,
          coverUrl: video.coverUrl,
          videoUrl: video.videoUrl,
          publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
          playCount: video.playCount,
          likeCount: video.likeCount,
          commentCount: video.commentCount,
          shareCount: video.shareCount,
        });
      }

      if (!result.hasMore) {
        break;
      }
    }
  }
}

export const syncService = new SyncService();
