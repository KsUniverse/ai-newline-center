import { BenchmarkVideo, UserRole } from "@prisma/client";

import {
  getTranscriptionQueue,
  TRANSCRIPTION_QUEUE_NAME,
  type TranscriptionJobData,
} from "@/lib/bullmq";
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

  private assertWorkspaceAccess(
    workspace: { organizationId: string; userId: string },
    caller: SessionUser,
  ): void {
    if (caller.role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (workspace.organizationId !== caller.organizationId || workspace.userId !== caller.id) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }
  }

  private requireTranscriptShareUrl(video: Pick<BenchmarkVideo, "shareUrl">): string {
    if (!video.shareUrl) {
      throw new AppError("AI_SHARE_URL_REQUIRED", "视频尚未补齐 shareUrl，无法发起转录", 400);
    }

    return video.shareUrl;
  }

  private async ensureWorkspaceForVideo(
    video: Awaited<ReturnType<typeof benchmarkVideoRepository.findByIdWithAccountOrganization>>,
    caller: SessionUser,
  ) {
    if (!video) {
      throw new AppError("VIDEO_NOT_FOUND", "视频不存在", 404);
    }

    const existing = await aiWorkspaceRepository.findByVideoIdAndUserId(video.id, caller.id);
    if (existing) {
      return existing;
    }

    return aiWorkspaceRepository.create({
      videoId: video.id,
      userId: caller.id,
      organizationId: video.account.organizationId,
    });
  }

  private async getWorkspaceRecordOrThrow(
    workspaceId: string,
    caller: SessionUser,
  ): Promise<AiWorkspaceWithDetails> {
    const workspace = await aiWorkspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    this.assertWorkspaceAccess(workspace, caller);
    return workspace;
  }

  private async getWorkspaceDtoOrThrow(workspaceId: string): Promise<AiWorkspaceDTO> {
    const latest = await aiWorkspaceRepository.findById(workspaceId);
    if (!latest) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    return this.toDto(latest);
  }

  private assertTranscriptConfirmed(workspace: AiWorkspaceWithDetails): void {
    if (!workspace.transcript?.isConfirmed) {
      throw new AppError("TRANSCRIPT_CONFIRM_REQUIRED", "请先确认转录稿，再进行拆解", 409);
    }
  }

  private assertTranscriptExists(workspace: AiWorkspaceWithDetails): void {
    const transcriptText =
      workspace.transcript?.currentText?.trim() ??
      workspace.transcript?.originalText?.trim() ??
      "";

    if (!transcriptText) {
      throw new AppError("TRANSCRIPT_REQUIRED", "请先生成或录入转录稿", 409);
    }
  }

  private assertRetranscriptionAllowed(workspace: AiWorkspaceWithDetails): void {
    if (workspace.status === "TRANSCRIBING") {
      throw new AppError("TRANSCRIPTION_IN_PROGRESS", "转录任务正在处理中", 409);
    }

    if (workspace.transcript?.isConfirmed || workspace.annotations.length > 0 || workspace.rewriteDraft) {
      throw new AppError("TRANSCRIPT_UNLOCK_REQUIRED", "请先解锁当前转录稿，再重新转录", 409);
    }
  }

  private assertTranscriptEditable(workspace: AiWorkspaceWithDetails): void {
    if (workspace.status === "TRANSCRIBING") {
      throw new AppError("TRANSCRIPTION_IN_PROGRESS", "转录任务正在处理中", 409);
    }

    if (workspace.transcript?.isConfirmed || workspace.annotations.length > 0 || workspace.rewriteDraft) {
      throw new AppError("TRANSCRIPT_UNLOCK_REQUIRED", "请先解锁当前转录稿，再继续编辑", 409);
    }
  }

  async getWorkspace(videoId: string, caller: SessionUser): Promise<AiWorkspaceDTO> {
    await this.getAccessibleBenchmarkVideo(videoId, caller);
    const workspace = await aiWorkspaceRepository.findByVideoIdAndUserId(videoId, caller.id);
    if (!workspace) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    return this.getWorkspaceDtoOrThrow(workspace.id);
  }

  async ensureWorkspace(videoId: string, caller: SessionUser): Promise<AiWorkspaceDTO> {
    const video = await this.getAccessibleBenchmarkVideo(videoId, caller);
    const workspace = await this.ensureWorkspaceForVideo(video, caller);
    return this.getWorkspaceDtoOrThrow(workspace.id);
  }

  async startTranscription(
    caller: SessionUser,
    videoId: string,
  ): Promise<AiWorkspaceDTO> {
    const video = await this.getAccessibleBenchmarkVideo(videoId, caller);
    const shareUrl = this.requireTranscriptShareUrl(video);
    const workspace = await this.ensureWorkspaceForVideo(video, caller);
    const workspaceDetails = await this.getWorkspaceRecordOrThrow(workspace.id, caller);
    this.assertRetranscriptionAllowed(workspaceDetails);
    const previousStatus = workspaceDetails.status;

    const payload: TranscriptionJobData = {
      transcriptionId: workspace.id,
      workspaceId: workspace.id,
      videoId,
      shareUrl,
      organizationId: video.account.organizationId,
      userId: caller.id,
    };

    await aiWorkspaceRepository.update(workspace.id, {
      status: "TRANSCRIBING",
    });

    try {
      await getTranscriptionQueue().add(
        TRANSCRIPTION_QUEUE_NAME,
        payload,
      );
    } catch (error) {
      await aiWorkspaceRepository.update(workspace.id, {
        status: previousStatus,
      });
      throw error;
    }

    return this.getWorkspaceDtoOrThrow(workspace.id);
  }

  async saveTranscript(
    workspaceId: string,
    caller: SessionUser,
    input: SaveTranscriptInput,
  ): Promise<AiWorkspaceDTO> {
    const workspace = await this.getWorkspaceRecordOrThrow(workspaceId, caller);
    this.assertTranscriptEditable(workspace);

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

    return this.getWorkspaceDtoOrThrow(workspaceId);
  }

  async confirmTranscript(workspaceId: string, caller: SessionUser): Promise<AiWorkspaceDTO> {
    const workspace = await this.getWorkspaceRecordOrThrow(workspaceId, caller);
    this.assertTranscriptExists(workspace);

    await aiWorkspaceRepository.upsertTranscript(workspaceId, workspace.organizationId, {
      isConfirmed: true,
      confirmedAt: new Date(),
      lastEditedAt: new Date(),
    });

    await aiWorkspaceRepository.update(workspaceId, {
      status: "TRANSCRIPT_CONFIRMED",
    });

    return this.getWorkspaceDtoOrThrow(workspaceId);
  }

  async unlockTranscript(workspaceId: string, caller: SessionUser): Promise<AiWorkspaceDTO> {
    const workspace = await this.getWorkspaceRecordOrThrow(workspaceId, caller);

    await aiWorkspaceRepository.resetTranscriptToDraft(workspaceId, workspace.organizationId, {
      lastEditedAt: new Date(),
    });

    return this.getWorkspaceDtoOrThrow(workspaceId);
  }

  async saveAnnotation(
    workspaceId: string,
    caller: SessionUser,
    input: SaveAnnotationInput,
  ): Promise<AiWorkspaceDTO> {
    const workspace = await this.getWorkspaceRecordOrThrow(workspaceId, caller);
    this.assertTranscriptConfirmed(workspace);

    await aiWorkspaceRepository.upsertAnnotation(
      workspaceId,
      workspace.organizationId,
      {
        ...input,
        createdByUserId: caller.id,
      },
    );

    await aiWorkspaceRepository.update(workspaceId, {
      status: "DECOMPOSED",
    });

    return this.getWorkspaceDtoOrThrow(workspaceId);
  }

  async updateAnnotation(
    workspaceId: string,
    annotationId: string,
    caller: SessionUser,
    input: SaveAnnotationInput,
  ): Promise<AiWorkspaceDTO> {
    const workspace = await this.getWorkspaceRecordOrThrow(workspaceId, caller);
    this.assertTranscriptConfirmed(workspace);

    const updated = await aiWorkspaceRepository.updateAnnotationInWorkspace(
      workspaceId,
      annotationId,
      input,
    );
    if (!updated) {
      throw new AppError("NOT_FOUND", "拆解不存在", 404);
    }

    await aiWorkspaceRepository.update(workspaceId, {
      status: "DECOMPOSED",
    });

    return this.getWorkspaceDtoOrThrow(workspaceId);
  }

  async deleteAnnotation(
    workspaceId: string,
    annotationId: string,
    caller: SessionUser,
  ): Promise<AiWorkspaceDTO> {
    const workspace = await this.getWorkspaceRecordOrThrow(workspaceId, caller);
    this.assertTranscriptConfirmed(workspace);

    const deleted = await aiWorkspaceRepository.deleteAnnotationInWorkspace(
      workspaceId,
      annotationId,
    );
    if (!deleted) {
      throw new AppError("NOT_FOUND", "拆解不存在", 404);
    }

    const latest = await aiWorkspaceRepository.findById(workspaceId);
    if (!latest) {
      throw new AppError("NOT_FOUND", "工作台不存在", 404);
    }

    await aiWorkspaceRepository.update(workspaceId, {
      status: latest.annotations.length > 0 ? "DECOMPOSED" : "TRANSCRIPT_CONFIRMED",
    });

    return this.getWorkspaceDtoOrThrow(workspaceId);
  }

  async saveRewriteDraft(
    workspaceId: string,
    caller: SessionUser,
    input: SaveRewriteDraftInput,
  ): Promise<AiWorkspaceDTO> {
    const workspace = await this.getWorkspaceRecordOrThrow(workspaceId, caller);
    this.assertTranscriptConfirmed(workspace);
    this.assertTranscriptExists(workspace);

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

    return this.getWorkspaceDtoOrThrow(workspaceId);
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


