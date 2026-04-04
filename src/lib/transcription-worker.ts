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

let initialized = false;

export function startTranscriptionWorker(): void {
  if (initialized) {
    return;
  }

  if (!env.REDIS_URL) {
    console.warn("[TranscriptionWorker] REDIS_URL not set, worker skipped.");
    return;
  }

  initialized = true;
  const publisher = createPubSubRedisClient();

  const worker = new Worker<TranscriptionJobData>(
    TRANSCRIPTION_QUEUE_NAME,
    async (job) => {
      const { transcriptionId, videoStoragePath, aiModel } = job.data;

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

      const originalText = await aiGateway.transcribe(videoStoragePath, aiModel);

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
