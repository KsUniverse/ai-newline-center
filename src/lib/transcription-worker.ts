import os from "node:os";
import path from "node:path";
import { rm, writeFile } from "node:fs/promises";

import { Worker } from "bullmq";

import { TRANSCRIPTION_QUEUE_NAME, type TranscriptionJobData } from "@/lib/bullmq";
import { env } from "@/lib/env";
import { createBullMQRedisConnection } from "@/lib/redis";
import { aiWorkspaceRepository } from "@/server/repositories/ai-workspace.repository";
import { aiGateway } from "@/server/services/ai-gateway.service";

declare global {
  // Persist worker startup across Next.js dev hot reloads in the same process.
  var __transcriptionWorkerInitialized: boolean | undefined;
}

export function startTranscriptionWorker(): void {
  if (globalThis.__transcriptionWorkerInitialized) {
    console.log("[TranscriptionWorker] already started, skipping", {
      pid: process.pid,
    });
    return;
  }

  if (!env.REDIS_URL) {
    console.warn("[TranscriptionWorker] REDIS_URL not set, worker skipped.");
    return;
  }

  globalThis.__transcriptionWorkerInitialized = true;

  const worker = new Worker<TranscriptionJobData>(
    TRANSCRIPTION_QUEUE_NAME,
    async (job) => {
      const { workspaceId, videoStoragePath, organizationId } = job.data;

      console.log("[TranscriptionWorker] Processing job", {
        jobId: job.id,
        workspaceId: workspaceId ?? null,
        organizationId,
        videoStoragePath: videoStoragePath ?? null,
      });

      if (!workspaceId) {
        throw new Error("Workspace transcription job is missing workspaceId");
      }

      if (!videoStoragePath) {
        throw new Error("Workspace transcription job is missing videoStoragePath");
      }

      // OSS 模式: videoStoragePath 是 https:// URL，需先下载到临时文件
      // 本地模式: videoStoragePath 是 /storage/videos/... 本地路径
      let absoluteVideoPath: string;
      let tempFilePath: string | null = null;

      if (videoStoragePath.startsWith("http://") || videoStoragePath.startsWith("https://")) {
        const ext = path.extname(new URL(videoStoragePath).pathname) || ".mp4";
        tempFilePath = path.join(os.tmpdir(), `transcription-${job.id}-${Date.now()}${ext}`);
        const response = await fetch(videoStoragePath, { signal: AbortSignal.timeout(120_000) });
        if (!response.ok) {
          throw new Error(`OSS 视频下载失败: ${response.status} ${videoStoragePath}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        await writeFile(tempFilePath, buffer);
        absoluteVideoPath = tempFilePath;
      } else {
        absoluteVideoPath = path.join(
          process.cwd(),
          "public",
          videoStoragePath.startsWith("/") ? videoStoragePath.slice(1) : videoStoragePath,
        );
      }

      try {
        const result = await aiGateway.generateTranscriptionFromVideo(absoluteVideoPath);

        await aiWorkspaceRepository.completeQueuedTranscription(workspaceId, organizationId, {
          originalText: result.text,
          currentText: result.text,
          aiProviderKey: result.modelConfigId,
          aiModel: result.modelName,
        });

        console.log("[TranscriptionWorker] Completed job", {
          jobId: job.id,
          workspaceId,
          organizationId,
          transcriptLength: result.text.length,
          aiProviderKey: result.modelConfigId,
          aiModel: result.modelName,
        });
      } finally {
        // 清理临时文件（OSS 模式下载的临时视频）
        if (tempFilePath) {
          await rm(tempFilePath, { force: true }).catch(() => undefined);
        }
      }
    },
    {
      connection: createBullMQRedisConnection(),
      concurrency: 2,
    },
  );

  worker.on("failed", async (job, error) => {
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    const maxAttempts = job?.opts.attempts ?? 3;

    console.warn("[TranscriptionWorker] Job attempt failed", {
      jobId: job?.id ?? null,
      workspaceId: job?.data.workspaceId ?? null,
      attemptsMade: job?.attemptsMade ?? null,
      maxAttempts,
      error: errorMessage,
    });

    if (!job || job.attemptsMade < (job.opts.attempts ?? 3)) {
      return;
    }

    try {
      console.error("[TranscriptionWorker] Job failed permanently", {
        jobId: job.id,
        workspaceId: job.data.workspaceId ?? null,
        attemptsMade: job.attemptsMade,
        maxAttempts,
        error: errorMessage,
      });

      if (!job.data.workspaceId) {
        throw new Error(errorMessage);
      }

      await aiWorkspaceRepository.markQueuedTranscriptionFailed(job.data.workspaceId);
    } catch (handlerError) {
      console.error("[TranscriptionWorker] Failed to persist FAILED state:", handlerError);
    }
  });

  console.log("[TranscriptionWorker] Worker started.");
}
