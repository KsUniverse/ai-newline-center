import { UserRole } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { douyinAccountRepository } from "@/server/repositories/douyin-account.repository";
import { douyinVideoRepository } from "@/server/repositories/douyin-video.repository";
import type { SessionUser } from "@/server/services/user.service";
import type { DouyinVideoWithAccountDTO } from "@/types/douyin-account";
import type { PaginatedData } from "@/types/api";

interface ListVideosParams {
  page: number;
  limit: number;
  accountId?: string;
  tag?: string;
  sort: "publishedAt" | "likeCount";
  order: "asc" | "desc";
}

class VideoService {
  async listVideos(
    caller: SessionUser,
    params: ListVideosParams,
  ): Promise<PaginatedData<DouyinVideoWithAccountDTO>> {
    const accountIds = await this.resolveVisibleAccountIds(caller);

    if (params.accountId && accountIds && !accountIds.includes(params.accountId)) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    const result = await douyinVideoRepository.findManyWithAccount({
      accountIds: params.accountId ? [params.accountId] : accountIds,
      page: params.page,
      limit: params.limit,
      sort: params.sort,
      order: params.order,
      tag: params.tag,
    });

    return {
      ...result,
      items: result.items.map((item) => ({
        id: item.id,
        videoId: item.videoId,
        title: item.title,
        coverUrl: item.coverUrl,
        coverSourceUrl: item.coverSourceUrl,
        coverStoragePath: item.coverStoragePath,
        videoUrl: item.videoUrl,
        videoSourceUrl: item.videoSourceUrl,
        videoStoragePath: item.videoStoragePath,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        playCount: item.playCount,
        likeCount: item.likeCount,
        commentCount: item.commentCount,
        shareCount: item.shareCount,
        collectCount: item.collectCount,
        admireCount: item.admireCount,
        recommendCount: item.recommendCount,
        tags: item.tags ?? [],
        createdAt: item.createdAt.toISOString(),
        accountNickname: item.account.nickname,
        accountAvatar: item.account.avatar,
      })),
    };
  }

  private async resolveVisibleAccountIds(caller: SessionUser): Promise<string[] | undefined> {
    switch (caller.role) {
      case UserRole.EMPLOYEE:
        return douyinAccountRepository.findMyAccountIdsByUserId(caller.id);
      case UserRole.BRANCH_MANAGER:
        return douyinAccountRepository.findIdsByOrganizationId(caller.organizationId);
      case UserRole.SUPER_ADMIN:
        return undefined;
      default:
        throw new AppError("FORBIDDEN", "无操作权限", 403);
    }
  }
}

export const videoService = new VideoService();
