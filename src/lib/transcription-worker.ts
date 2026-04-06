import { Worker } from "bullmq";

import { TRANSCRIPTION_QUEUE_NAME, type TranscriptionJobData } from "@/lib/bullmq";
import { env } from "@/lib/env";
import {
  createBullMQRedisConnection,
  createPubSubRedisClient,
  TRANSCRIPTION_CHANNEL_PREFIX,
} from "@/lib/redis";
import { transcriptionRepository } from "@/server/repositories/transcription.repository";
import { aiGateway } from "@/server/services/ai-gateway.service";

function buildShareUrlPrompt(shareUrl: string): string {
  return [
    "你是短视频文案研究助手。",
    "请基于下面的短视频分享链接，整理出一份结构清晰、便于后续人工拆解的转录主文档。",
    "要求：",
    "1. 保留原视频表达顺序；",
    "2. 语义连贯地分段；",
    "3. 输出为可读中文正文，不要解释你的推理过程；",
    `分享链接：${shareUrl}`,
  ].join("\n");
}

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

  const worker = new Worker<TranscriptionJobData>(
    TRANSCRIPTION_QUEUE_NAME,
    async (job) => {
      const { transcriptionId, shareUrl, videoStoragePath, aiProviderKey } = job.data;

      await transcriptionRepository.updateStatus(transcriptionId, {
        status: "PROCESSING",
        errorMessage: null,
      });
      await publisher.publish(
        `${TRANSCRIPTION_CHANNEL_PREFIX}${transcriptionId}`,
        JSON.stringify({
          event: "status",
          data: { transcriptionId, status: "PROCESSING" },
        }),
      );

      const promptSource = shareUrl ?? videoStoragePath;
      if (!promptSource) {
        throw new Error("Transcription job is missing shareUrl");
      }

      const { text: originalText } = await aiGateway.generateText(
        "TRANSCRIBE",
        buildShareUrlPrompt(promptSource),
        aiProviderKey ?? undefined,
      );

      await transcriptionRepository.updateStatus(transcriptionId, {
        status: "COMPLETED",
        originalText,
        errorMessage: null,
      });
      await publisher.publish(
        `${TRANSCRIPTION_CHANNEL_PREFIX}${transcriptionId}`,
        JSON.stringify({
          event: "done",
          data: { transcriptionId, status: "COMPLETED", originalText },
        }),
      );
    },
    {
      connection: createBullMQRedisConnection(),
      concurrency: 2,
    },
  );

  worker.on("failed", async (job, error) => {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 3)) {
      return;
    }

    try {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      await transcriptionRepository.updateStatus(job.data.transcriptionId, {
        status: "FAILED",
        errorMessage,
      });
      await publisher.publish(
        `${TRANSCRIPTION_CHANNEL_PREFIX}${job.data.transcriptionId}`,
        JSON.stringify({
          event: "error",
          data: {
            transcriptionId: job.data.transcriptionId,
            status: "FAILED",
            errorMessage,
          },
        }),
      );
    } catch (handlerError) {
      console.error("[TranscriptionWorker] Failed to persist FAILED state:", handlerError);
    }
  });

  console.log("[TranscriptionWorker] Worker started.");
}
