import { TranscriptionStatus, UserRole } from "@prisma/client";

import { getTranscriptionQueue, TRANSCRIPTION_QUEUE_NAME } from "@/lib/bullmq";
import { AppError } from "@/lib/errors";
import { transcriptionRepository } from "@/server/repositories/transcription.repository";
import { benchmarkVideoRepository } from "@/server/repositories/benchmark-video.repository";
import type { SessionUser } from "@/types/session";
import type { TranscriptionDTO } from "@/types/transcription";
import { env } from "@/lib/env";

class TranscriptionService {
  async createTranscription(videoId: string, caller: SessionUser): Promise<TranscriptionDTO> {
    const video = await this.getAccessibleVideo(videoId, caller);

    if (!video.videoStoragePath) {
      throw new AppError("VIDEO_NOT_DOWNLOADED", "视频文件尚未下载，请等待同步完成", 400);
    }

    const existing = await transcriptionRepository.findByVideoId(videoId);
    if (
      existing &&
      (existing.status === TranscriptionStatus.PENDING ||
        existing.status === TranscriptionStatus.PROCESSING)
    ) {
      throw new AppError("TRANSCRIPTION_IN_PROGRESS", "转录任务正在处理中", 409);
    }

    const transcription = existing
      ? await transcriptionRepository.reset(existing.id, env.TRANSCRIPTION_AI_MODEL)
      : await transcriptionRepository.create({
          videoId,
          aiModel: env.TRANSCRIPTION_AI_MODEL,
        });

    await getTranscriptionQueue().add(TRANSCRIPTION_QUEUE_NAME, {
      transcriptionId: transcription.id,
      videoStoragePath: video.videoStoragePath,
      aiModel: transcription.aiModel,
      organizationId: video.account.organizationId,
    });

    const latest = await transcriptionRepository.findById(transcription.id);
    if (!latest) {
      throw new AppError("NOT_FOUND", "转录记录不存在", 404);
    }

    return this.toTranscriptionDTO(latest);
  }

  async getByVideoId(videoId: string, caller: SessionUser): Promise<TranscriptionDTO> {
    await this.getAccessibleVideo(videoId, caller);

    const transcription = await transcriptionRepository.findByVideoId(videoId);
    if (!transcription) {
      throw new AppError("NOT_FOUND", "转录记录不存在", 404);
    }

    return this.toTranscriptionDTO(transcription);
  }

  async getById(transcriptionId: string, caller: SessionUser): Promise<TranscriptionDTO> {
    const transcription = await transcriptionRepository.findById(transcriptionId);
    if (!transcription) {
      throw new AppError("NOT_FOUND", "转录记录不存在", 404);
    }

    this.assertCanAccessOrganization(caller, transcription.video.account.organizationId);
    return this.toTranscriptionDTO(transcription);
  }

  async updateEditedText(
    transcriptionId: string,
    editedText: string | null,
    caller: SessionUser,
  ): Promise<TranscriptionDTO> {
    const transcription = await transcriptionRepository.findById(transcriptionId);
    if (!transcription) {
      throw new AppError("NOT_FOUND", "转录记录不存在", 404);
    }

    this.assertCanAccessOrganization(caller, transcription.video.account.organizationId);

    if (transcription.status !== TranscriptionStatus.COMPLETED) {
      throw new AppError("TRANSCRIPTION_NOT_COMPLETED", "仅已完成转录支持人工编辑", 400);
    }

    await transcriptionRepository.updateEditedText(transcriptionId, editedText);
    const latest = await transcriptionRepository.findById(transcriptionId);
    if (!latest) {
      throw new AppError("NOT_FOUND", "转录记录不存在", 404);
    }

    return this.toTranscriptionDTO(latest);
  }

  private async getAccessibleVideo(videoId: string, caller: SessionUser) {
    const video = await benchmarkVideoRepository.findByIdWithAccountOrganization(videoId);

    if (!video) {
      throw new AppError("VIDEO_NOT_FOUND", "视频不存在", 404);
    }

    this.assertCanAccessOrganization(caller, video.account.organizationId);
    return video;
  }

  private assertCanAccessOrganization(caller: SessionUser, organizationId: string): void {
    if (caller.role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (caller.organizationId !== organizationId) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }
  }

  private toTranscriptionDTO(record: Awaited<ReturnType<typeof transcriptionRepository.findById>> extends infer T
    ? NonNullable<T>
    : never): TranscriptionDTO {
    return {
      id: record.id,
      videoId: record.videoId,
      status: record.status,
      aiModel: record.aiModel,
      originalText: record.originalText,
      editedText: record.editedText,
      errorMessage: record.errorMessage,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

export const transcriptionService = new TranscriptionService();
