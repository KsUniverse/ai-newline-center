import path from "node:path";

import { Worker } from "bullmq";

import { buildTranscriptStreamChannel, chunkText } from "@/lib/ai-stream";
import { TRANSCRIPTION_QUEUE_NAME, type TranscriptionJobData } from "@/lib/bullmq";
import { env } from "@/lib/env";
import { createBullMQRedisConnection, createPubSubRedisClient } from "@/lib/redis";
import { aiWorkspaceRepository } from "@/server/repositories/ai-workspace.repository";
import { aiGateway } from "@/server/services/ai-gateway.service";
import { AppError } from "@/lib/errors";

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
  const publisher = createPubSubRedisClient();

  async function publishTranscriptionEvent(
    workspaceId: string,
    event: string,
    data: unknown,
  ): Promise<void> {
    await publisher.publish(
      buildTranscriptStreamChannel(workspaceId),
      JSON.stringify({
        event,
        data,
      }),
    );
  }

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

      // OSS 模式: videoStoragePath 是 https:// URL，直接传给 AI 网关（无需下载）
      // 本地模式: videoStoragePath 是 /storage/videos/... 本地路径，转为绝对路径
      let videoInput: string;

      if (videoStoragePath.startsWith("http://") || videoStoragePath.startsWith("https://")) {
        videoInput = videoStoragePath;
      } else {
        videoInput = path.join(
          process.cwd(),
          "public",
          videoStoragePath.startsWith("/") ? videoStoragePath.slice(1) : videoStoragePath,
        );
      }

      try {
        await publishTranscriptionEvent(workspaceId, "start", {
          kind: "transcript",
        });
        const result = await aiGateway.generateTranscriptionFromVideo(videoInput);
        for (const delta of chunkText(result.text, 24)) {
          await publishTranscriptionEvent(workspaceId, "delta", {
            kind: "transcript",
            delta,
          });
        }

        await aiWorkspaceRepository.completeQueuedTranscription(workspaceId, organizationId, {
          originalText: result.text,
          currentText: result.text,
          aiProviderKey: result.modelConfigId,
          aiModel: result.modelName,
        });

        await publishTranscriptionEvent(workspaceId, "done", {
          kind: "transcript",
          text: result.text,
          modelConfigId: result.modelConfigId,
          modelName: result.modelName,
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
        // no temp files to clean up; download (if any) is handled by the AI gateway
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
      await publishTranscriptionEvent(job.data.workspaceId, "error", {
        kind: "transcript",
        code: error instanceof AppError ? error.code : "TRANSCRIPTION_FAILED",
        message: errorMessage,
      });
    } catch (handlerError) {
      console.error("[TranscriptionWorker] Failed to persist FAILED state:", handlerError);
    }
  });

  console.log("[TranscriptionWorker] Worker started.");
}
