import { BenchmarkVideo, UserRole } from "@prisma/client";

import { getTranscriptionQueue, TRANSCRIPTION_QUEUE_NAME } from "@/lib/bullmq";
import { AppError } from "@/lib/errors";
import { benchmarkVideoRepository } from "@/server/repositories/benchmark-video.repository";
import {
  aiWorkspaceRepository,
  type AiWorkspaceWithDetails,
} from "@/server/repositories/ai-workspace.repository";
import type { SessionUser } from "@/types/session";
import type {
  AiWorkspaceDTO,
  SaveAnnotationInput,
  SaveRewriteDraftInput,
  SaveTranscriptInput,
} from "@/types/ai-workspace";

interface TranscriptionQueuePayload {
  workspaceId: string;
  videoId: string;
  shareUrl: string;
  videoStoragePath: string | null;
  organizationId: string;
  userId: string;
}

class AiWorkspaceService {
  private async getAccessibleBenchmarkVideo(videoId: string, caller: SessionUser) {
    const video = await benchmarkVideoRepository.findByIdWithAccountOrganization(videoId);
    if (!video) {
      throw new AppError("VIDEO_NOT_FOUND", "视频不存在", 404);
    }

    if (
      caller.role !== UserRole.SUPER_ADMIN &&
      caller.organizationId !== video.account.organizationId
    ) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    return video;
  }

  private assertWorkspaceAccess(workspace: { organizationId: string }, caller: SessionUser): void {
    if (caller.role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (workspace.organizationId !== caller.organizationId) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }
  }

  private requireTranscriptShareUrl(video: Pick<BenchmarkVideo, "shareUrl">): string {
    if (!video.shareUrl) {
      throw new AppError("AI_SHARE_URL_REQUIRED", "视频尚未补齐 shareUrl，无法发起转录", 400);
    }

    return video.shareUrl;
  }

  async getWorkspace(videoId: string, caller: SessionUser): Promise<AiWorkspaceDTO> {
    const video = await this.getAccessibleBenchmarkVideo(videoId, caller);
    let workspace = await aiWorkspaceRepository.findByVideoIdAndUserId(videoId, caller.id);

    if (!workspace) {
      workspace = await aiWorkspaceRepository.create({
        videoId,
        userId: caller.id,
        organizationId: video.account.organizationId,
      });
    }

    const latest = await aiWorkspaceRepository.findById(workspace.id);
    if (!latest) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    this.assertWorkspaceAccess(latest, caller);
    return this.toDto(latest);
  }

  async startTranscription(
    caller: SessionUser,
    videoId: string,
  ): Promise<AiWorkspaceDTO> {
    const video = await this.getAccessibleBenchmarkVideo(videoId, caller);
    const shareUrl = this.requireTranscriptShareUrl(video);

    let workspace = await aiWorkspaceRepository.findByVideoIdAndUserId(videoId, caller.id);
    if (!workspace) {
      workspace = await aiWorkspaceRepository.create({
        videoId,
        userId: caller.id,
        organizationId: video.account.organizationId,
      });
    }

    await aiWorkspaceRepository.update(workspace.id, {
      status: "TRANSCRIBING",
    });

    const payload: TranscriptionQueuePayload = {
      workspaceId: workspace.id,
      videoId,
      shareUrl,
      videoStoragePath: video.videoStoragePath,
      organizationId: video.account.organizationId,
      userId: caller.id,
    };

    await getTranscriptionQueue().add(
      TRANSCRIPTION_QUEUE_NAME,
      payload as unknown as never,
    );

    const latest = await aiWorkspaceRepository.findById(workspace.id);
    if (!latest) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    return this.toDto(latest);
  }

  async saveTranscript(
    workspaceId: string,
    caller: SessionUser,
    input: SaveTranscriptInput,
  ): Promise<AiWorkspaceDTO> {
    const workspace = await aiWorkspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    this.assertWorkspaceAccess(workspace, caller);

    await aiWorkspaceRepository.upsertTranscript(workspaceId, workspace.organizationId, {
      currentText: input.currentText,
      lastEditedAt: new Date(),
      isConfirmed: false,
    });

    await aiWorkspaceRepository.replaceSegments(
      workspaceId,
      workspace.organizationId,
      input.segments.map((segment) => ({
        sortOrder: segment.sortOrder,
        text: segment.text,
        summary: segment.summary ?? null,
        purpose: segment.purpose ?? null,
        startOffset: segment.startOffset,
        endOffset: segment.endOffset,
      })),
    );

    const latest = await aiWorkspaceRepository.findById(workspaceId);
    if (!latest) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    return this.toDto(latest);
  }

  async confirmTranscript(workspaceId: string, caller: SessionUser): Promise<AiWorkspaceDTO> {
    const workspace = await aiWorkspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    this.assertWorkspaceAccess(workspace, caller);

    await aiWorkspaceRepository.upsertTranscript(workspaceId, workspace.organizationId, {
      isConfirmed: true,
      confirmedAt: new Date(),
      lastEditedAt: new Date(),
    });

    await aiWorkspaceRepository.update(workspaceId, {
      status: "TRANSCRIPT_CONFIRMED",
    });

    const latest = await aiWorkspaceRepository.findById(workspaceId);
    if (!latest) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    return this.toDto(latest);
  }

  async unlockTranscript(workspaceId: string, caller: SessionUser): Promise<AiWorkspaceDTO> {
    const workspace = await aiWorkspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    this.assertWorkspaceAccess(workspace, caller);

    await aiWorkspaceRepository.clearDependencies(workspaceId);
    await aiWorkspaceRepository.upsertTranscript(workspaceId, workspace.organizationId, {
      isConfirmed: false,
      confirmedAt: null,
      lastEditedAt: new Date(),
    });
    await aiWorkspaceRepository.update(workspaceId, {
      status: "TRANSCRIPT_DRAFT",
    });

    const latest = await aiWorkspaceRepository.findById(workspaceId);
    if (!latest) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    return this.toDto(latest);
  }

  async saveAnnotation(
    workspaceId: string,
    caller: SessionUser,
    input: SaveAnnotationInput,
  ): Promise<AiWorkspaceDTO> {
    const workspace = await aiWorkspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    this.assertWorkspaceAccess(workspace, caller);

    await aiWorkspaceRepository.upsertAnnotation(
      workspaceId,
      workspace.organizationId,
      {
        ...input,
        createdByUserId: caller.id,
      },
    );

    await aiWorkspaceRepository.update(workspaceId, {
      status: "DECOMPOSING",
    });

    const latest = await aiWorkspaceRepository.findById(workspaceId);
    if (!latest) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    return this.toDto(latest);
  }

  async updateAnnotation(
    workspaceId: string,
    annotationId: string,
    caller: SessionUser,
    input: SaveAnnotationInput,
  ): Promise<AiWorkspaceDTO> {
    const workspace = await aiWorkspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    this.assertWorkspaceAccess(workspace, caller);

    await aiWorkspaceRepository.updateAnnotation(annotationId, input);

    const latest = await aiWorkspaceRepository.findById(workspaceId);
    if (!latest) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    return this.toDto(latest);
  }

  async deleteAnnotation(
    workspaceId: string,
    annotationId: string,
    caller: SessionUser,
  ): Promise<AiWorkspaceDTO> {
    const workspace = await aiWorkspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    this.assertWorkspaceAccess(workspace, caller);

    await aiWorkspaceRepository.deleteAnnotation(annotationId);

    const latest = await aiWorkspaceRepository.findById(workspaceId);
    if (!latest) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    return this.toDto(latest);
  }

  async saveRewriteDraft(
    workspaceId: string,
    caller: SessionUser,
    input: SaveRewriteDraftInput,
  ): Promise<AiWorkspaceDTO> {
    const workspace = await aiWorkspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    this.assertWorkspaceAccess(workspace, caller);

    await aiWorkspaceRepository.upsertRewriteDraft(workspaceId, workspace.organizationId, {
      currentDraft: input.currentDraft,
      sourceTranscriptText:
        workspace.transcript?.currentText ?? workspace.transcript?.originalText ?? null,
      sourceDecompositionSnapshot: workspace.annotations.map((annotation) => ({
        id: annotation.id,
        segmentId: annotation.segmentId,
        startOffset: annotation.startOffset,
        endOffset: annotation.endOffset,
        quotedText: annotation.quotedText,
        function: annotation.function,
        argumentRole: annotation.argumentRole,
        technique: annotation.technique,
        purpose: annotation.purpose,
        effectiveness: annotation.effectiveness,
        note: annotation.note,
      })),
    });

    await aiWorkspaceRepository.update(workspaceId, {
      status: "REWRITING",
      enteredRewriteAt: workspace.enteredRewriteAt ?? new Date(),
    });

    const latest = await aiWorkspaceRepository.findById(workspaceId);
    if (!latest) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    return this.toDto(latest);
  }

  private toDto(workspace: NonNullable<AiWorkspaceWithDetails>) {
    return {
      id: workspace.id,
      videoId: workspace.videoId,
      userId: workspace.userId,
      organizationId: workspace.organizationId,
      status: workspace.status,
      enteredRewriteAt: workspace.enteredRewriteAt?.toISOString() ?? null,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
      video: {
        id: workspace.video.id,
        title: workspace.video.title,
        coverUrl: workspace.video.coverUrl,
        shareUrl: workspace.video.shareUrl,
        publishedAt: workspace.video.publishedAt?.toISOString() ?? null,
        playCount: workspace.video.playCount,
        likeCount: workspace.video.likeCount,
        commentCount: workspace.video.commentCount,
        shareCount: workspace.video.shareCount,
      },
      transcript: workspace.transcript
        ? {
            originalText: workspace.transcript.originalText,
            currentText: workspace.transcript.currentText,
            isConfirmed: workspace.transcript.isConfirmed,
            confirmedAt: workspace.transcript.confirmedAt?.toISOString() ?? null,
            lastEditedAt: workspace.transcript.lastEditedAt?.toISOString() ?? null,
            aiProviderKey: workspace.transcript.aiProviderKey,
            aiModel: workspace.transcript.aiModel,
          }
        : null,
      segments: workspace.segments.map((segment: AiWorkspaceWithDetails["segments"][number]) => ({
        id: segment.id,
        sortOrder: segment.sortOrder,
        text: segment.text,
        summary: segment.summary,
        purpose: segment.purpose,
        startOffset: segment.startOffset,
        endOffset: segment.endOffset,
      })),
      annotations: workspace.annotations.map(
        (annotation: AiWorkspaceWithDetails["annotations"][number]) => ({
        id: annotation.id,
        segmentId: annotation.segmentId,
        startOffset: annotation.startOffset,
        endOffset: annotation.endOffset,
        quotedText: annotation.quotedText,
        function: annotation.function,
        argumentRole: annotation.argumentRole,
        technique: annotation.technique,
        purpose: annotation.purpose,
        effectiveness: annotation.effectiveness,
        note: annotation.note,
        createdAt: annotation.createdAt.toISOString(),
        updatedAt: annotation.updatedAt.toISOString(),
      }),
      ),
      rewriteDraft: workspace.rewriteDraft
        ? {
            currentDraft: workspace.rewriteDraft.currentDraft,
            sourceTranscriptText: workspace.rewriteDraft.sourceTranscriptText,
            sourceDecompositionSnapshot: workspace.rewriteDraft.sourceDecompositionSnapshot,
          }
        : null,
    };
  }
}

export const aiWorkspaceService = new AiWorkspaceService();


