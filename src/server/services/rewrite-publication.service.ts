import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { douyinAccountRepository } from "@/server/repositories/douyin-account.repository";
import { douyinVideoRepository } from "@/server/repositories/douyin-video.repository";
import { rewritePublicationRepository } from "@/server/repositories/rewrite-publication.repository";
import { rewriteRepository } from "@/server/repositories/rewrite.repository";
import { douyinAccountStyleProfileService } from "@/server/services/douyin-account-style-profile.service";
import { rewriteLearningCaseService } from "@/server/services/rewrite-learning-case.service";
import type { SessionUser } from "@/types/session";

interface LinkPublishedVideoInput {
  publishedVideoId: string;
}

class RewritePublicationService {
  async getPublication(rewriteVersionId: string, caller: SessionUser) {
    const version = await rewriteRepository.findVersionById(rewriteVersionId);
    if (!version) {
      throw new AppError("REWRITE_VERSION_NOT_FOUND", "版本不存在", 404);
    }

    if (version.rewrite.organizationId !== caller.organizationId || version.rewrite.userId !== caller.id) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    return rewritePublicationRepository.findActiveByVersionId(rewriteVersionId);
  }

  async listPublicationCandidates(rewriteVersionId: string, caller: SessionUser) {
    const version = await rewriteRepository.findVersionById(rewriteVersionId);
    if (!version) {
      throw new AppError("REWRITE_VERSION_NOT_FOUND", "版本不存在", 404);
    }

    if (version.rewrite.organizationId !== caller.organizationId || version.rewrite.userId !== caller.id) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    if (!version.rewrite.targetAccountId) {
      throw new AppError("TARGET_ACCOUNT_REQUIRED", "当前版本未绑定目标账号", 400);
    }

    const ownedAccount = await douyinAccountRepository.findOwnedMyAccount(
      version.rewrite.targetAccountId,
      caller.id,
      caller.organizationId,
    );
    if (!ownedAccount) {
      throw new AppError("ACCOUNT_ACCESS_DENIED", "无权访问目标账号", 403);
    }

    const { items } = await douyinVideoRepository.findByAccountId({
      accountId: version.rewrite.targetAccountId,
      page: 1,
      limit: 50,
    });
    const activePublications = await prisma.rewritePublication.findMany({
      where: {
        targetAccountId: version.rewrite.targetAccountId,
        organizationId: caller.organizationId,
        status: "LINKED",
      },
      select: {
        publishedVideoId: true,
        rewriteVersionId: true,
      },
    });
    const occupiedByVideoId = new Map(
      activePublications.map((item) => [item.publishedVideoId, item.rewriteVersionId]),
    );

    return items.map((video) => ({
      id: video.id,
      title: video.title,
      coverUrl: video.coverUrl,
      publishedAt: video.publishedAt?.toISOString() ?? null,
      playCount: video.playCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      shareCount: video.shareCount,
      disabled:
        occupiedByVideoId.has(video.id) && occupiedByVideoId.get(video.id) !== rewriteVersionId,
      disabledReason:
        occupiedByVideoId.has(video.id) && occupiedByVideoId.get(video.id) !== rewriteVersionId
          ? "已被其他仿写版本关联"
          : null,
    }));
  }

  async linkPublishedVideo(
    rewriteVersionId: string,
    input: LinkPublishedVideoInput,
    caller: SessionUser,
  ) {
    const version = await rewriteRepository.findVersionById(rewriteVersionId);
    if (!version) {
      throw new AppError("REWRITE_VERSION_NOT_FOUND", "版本不存在", 404);
    }

    const rewrite = (version as typeof version & {
      rewrite: {
        id: string;
        targetAccountId?: string | null;
        userId: string;
        organizationId: string;
      };
      generatedContent?: string | null;
      editedContent?: string | null;
      status?: string;
    }).rewrite;

    if (rewrite.organizationId !== caller.organizationId || rewrite.userId !== caller.id) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    if ((version as { status?: string }).status !== "COMPLETED") {
      throw new AppError("REWRITE_VERSION_NOT_COMPLETED", "仅已完成版本可关联发布视频", 400);
    }

    if (!rewrite.targetAccountId) {
      throw new AppError("TARGET_ACCOUNT_REQUIRED", "当前版本未绑定目标账号", 400);
    }

    const finalContent =
      (version as { editedContent?: string | null }).editedContent ??
      (version as { generatedContent?: string | null }).generatedContent ??
      null;

    if (!finalContent?.trim()) {
      throw new AppError(
        "REWRITE_VERSION_EMPTY_FINAL_CONTENT",
        "当前版本没有可学习的文案内容",
        400,
      );
    }

    const ownedAccount = await douyinAccountRepository.findOwnedMyAccount(
      rewrite.targetAccountId,
      caller.id,
      caller.organizationId,
    );
    if (!ownedAccount) {
      throw new AppError("ACCOUNT_ACCESS_DENIED", "无权访问目标账号", 403);
    }

    const publishedVideo = await douyinVideoRepository.findById(input.publishedVideoId);
    if (!publishedVideo) {
      throw new AppError("PUBLISHED_VIDEO_NOT_FOUND", "发布视频不存在", 404);
    }

    if (publishedVideo.accountId !== rewrite.targetAccountId) {
      throw new AppError("PUBLISHED_VIDEO_ACCOUNT_MISMATCH", "该视频不属于目标账号", 400);
    }

    const occupiedPublication = await rewritePublicationRepository.findActiveByPublishedVideoId(
      input.publishedVideoId,
    );
    if (occupiedPublication && occupiedPublication.rewriteVersionId !== rewriteVersionId) {
      throw new AppError("PUBLISHED_VIDEO_ALREADY_LINKED", "该视频已被其他版本关联", 409);
    }

    const existingPublication =
      await rewritePublicationRepository.findActiveByVersionId(rewriteVersionId);
    if (existingPublication) {
      return existingPublication;
    }

    const publication = await rewritePublicationRepository.create({
      rewriteVersionId,
      rewriteId: rewrite.id,
      targetAccountId: rewrite.targetAccountId,
      publishedVideoId: input.publishedVideoId,
      organizationId: caller.organizationId,
    });

    await rewriteLearningCaseService.refreshFromPublication(publication.id);
    return publication;
  }

  async unlinkPublishedVideo(rewriteVersionId: string, caller: SessionUser): Promise<void> {
    const version = await rewriteRepository.findVersionById(rewriteVersionId);
    if (!version) {
      throw new AppError("REWRITE_VERSION_NOT_FOUND", "版本不存在", 404);
    }

    if (version.rewrite.organizationId !== caller.organizationId || version.rewrite.userId !== caller.id) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    const publication = await rewritePublicationRepository.findActiveByVersionId(rewriteVersionId);
    if (!publication) {
      return;
    }

    await rewritePublicationRepository.unlinkActiveByVersionId(rewriteVersionId);
    await rewriteLearningCaseService.archiveByPublicationId(publication.id);
    await douyinAccountStyleProfileService.rebuildForAccount(
      publication.targetAccountId,
      publication.organizationId,
    );
  }
}

export const rewritePublicationService = new RewritePublicationService();
