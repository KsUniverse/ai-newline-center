import { UserRole } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { douyinAccountRepository } from "@/server/repositories/douyin-account.repository";
import { douyinVideoRepository } from "@/server/repositories/douyin-video.repository";
import { rewriteRepository } from "@/server/repositories/rewrite.repository";
import { videoRewriteLinkRepository } from "@/server/repositories/video-rewrite-link.repository";
import { videoSnapshotRepository } from "@/server/repositories/video-snapshot.repository";
import { mapDouyinVideoWithAccountToDto } from "@/server/services/douyin-account.mapper";
import type { SessionUser } from "@/types/session";
import type { DouyinVideoWithAccountDTO } from "@/types/douyin-account";
import type { PaginatedData } from "@/types/api";
import type { VideoRewriteLinkDTO, VideoSnapshotDTO } from "@/types/video-link";

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
      items: result.items.map(mapDouyinVideoWithAccountToDto),
    };
  }

  async getSnapshots(
    videoId: string,
    caller: SessionUser,
    days: number,
  ): Promise<VideoSnapshotDTO[]> {
    await this.assertVideoVisible(videoId, caller);

    const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const snapshots = await videoSnapshotRepository.findByVideoId({
      videoId,
      startTime,
    });

    return snapshots
      .map((s) => ({
        id: s.id,
        timestamp: s.timestamp.toISOString(),
        playsCount: s.playsCount,
        likesCount: s.likesCount,
        commentsCount: s.commentsCount,
        sharesCount: s.sharesCount,
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  async getRewriteLink(
    videoId: string,
    caller: SessionUser,
  ): Promise<VideoRewriteLinkDTO | null> {
    await this.assertVideoVisible(videoId, caller);

    const link = await videoRewriteLinkRepository.findByVideoId(videoId);
    if (!link) return null;

    return this.mapLinkToDTO(link);
  }

  async linkRewrite(
    videoId: string,
    rewriteId: string,
    caller: SessionUser,
  ): Promise<VideoRewriteLinkDTO> {
    if (caller.role !== UserRole.EMPLOYEE) {
      throw new AppError("FORBIDDEN", "只有员工可以执行关联操作", 403);
    }

    const video = await this.assertVideoOwnedByCaller(videoId, caller);
    void video;

    // Verify rewrite belongs to caller and has a final version
    const rewrite = await rewriteRepository.findByIdAndUser(
      rewriteId,
      caller.id,
      caller.organizationId,
    );
    if (!rewrite) {
      throw new AppError("REWRITE_NOT_FOUND", "仿写任务不存在或无权访问", 404);
    }
    const hasFinalVersion = rewrite.versions.some((v) => v.isFinalVersion);
    if (!hasFinalVersion) {
      throw new AppError("NO_FINAL_VERSION", "该仿写任务没有最终稿", 400);
    }

    const link = await videoRewriteLinkRepository.create({ videoId, rewriteId });
    return this.mapLinkToDTO(link);
  }

  async unlinkRewrite(videoId: string, caller: SessionUser): Promise<void> {
    if (caller.role !== UserRole.EMPLOYEE) {
      throw new AppError("FORBIDDEN", "只有员工可以执行取消关联操作", 403);
    }

    await this.assertVideoOwnedByCaller(videoId, caller);
    await videoRewriteLinkRepository.deleteByVideoId(videoId);
  }

  private async assertVideoVisible(videoId: string, caller: SessionUser) {
    const video = await douyinVideoRepository.findById(videoId);
    if (!video) {
      throw new AppError("VIDEO_NOT_FOUND", "视频不存在", 404);
    }

    if (caller.role === UserRole.EMPLOYEE) {
      const ownedAccountIds = await douyinAccountRepository.findIdsByUserId(caller.id);
      if (!ownedAccountIds.includes(video.accountId)) {
        throw new AppError("FORBIDDEN", "无操作权限", 403);
      }
    } else if (caller.role === UserRole.BRANCH_MANAGER) {
      const orgAccountIds = await douyinAccountRepository.findIdsByOrganizationId(
        caller.organizationId,
      );
      if (!orgAccountIds.includes(video.accountId)) {
        throw new AppError("FORBIDDEN", "无操作权限", 403);
      }
    }

    return video;
  }

  private async assertVideoOwnedByCaller(videoId: string, caller: SessionUser) {
    const video = await douyinVideoRepository.findById(videoId);
    if (!video) {
      throw new AppError("VIDEO_NOT_FOUND", "视频不存在", 404);
    }

    const ownedAccountIds = await douyinAccountRepository.findIdsByUserId(caller.id);
    if (!ownedAccountIds.includes(video.accountId)) {
      throw new AppError("FORBIDDEN", "该视频不属于当前用户的账号", 403);
    }

    return video;
  }

  private mapLinkToDTO(
    link: Awaited<ReturnType<typeof videoRewriteLinkRepository.findByVideoId>>,
  ): VideoRewriteLinkDTO {
    if (!link) throw new AppError("LINK_NOT_FOUND", "关联不存在", 404);

    const finalVersion = link.rewrite.versions[0];
    const finalContent = finalVersion?.editedContent ?? finalVersion?.generatedContent ?? null;

    return {
      id: link.id,
      rewriteId: link.rewriteId,
      rewriteMode: link.rewrite.mode as "WORKSPACE" | "DIRECT",
      rewriteTopic: link.rewrite.topic ?? null,
      targetAccountNickname: link.rewrite.targetAccount?.nickname ?? null,
      finalContent,
      linkedAt: link.linkedAt.toISOString(),
    };
  }

  private async resolveVisibleAccountIds(caller: SessionUser): Promise<string[] | undefined> {
    switch (caller.role) {
      case UserRole.EMPLOYEE:
        return douyinAccountRepository.findIdsByUserId(caller.id);
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
