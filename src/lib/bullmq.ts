import { Queue } from "bullmq";

import { createBullMQRedisConnection } from "@/lib/redis";

export const TRANSCRIPTION_QUEUE_NAME = "transcription";

export interface TranscriptionJobData {
  transcriptionId: string;
  videoId?: string;
  videoStoragePath?: string | null;
  organizationId: string;
  workspaceId?: string;
  userId?: string;
}

let transcriptionQueue: Queue<TranscriptionJobData> | null = null;

export function getTranscriptionQueue(): Queue<TranscriptionJobData> {
  if (!transcriptionQueue) {
    transcriptionQueue = new Queue<TranscriptionJobData>(TRANSCRIPTION_QUEUE_NAME, {
      connection: createBullMQRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: false,
      },
    });
  }

  return transcriptionQueue;
}
