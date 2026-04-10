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

export const REWRITE_QUEUE_NAME = "rewrite";

export interface RewriteJobData {
  rewriteVersionId: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
}

let rewriteQueue: Queue<RewriteJobData> | null = null;

export function getRewriteQueue(): Queue<RewriteJobData> {
  if (!rewriteQueue) {
    rewriteQueue = new Queue<RewriteJobData>(REWRITE_QUEUE_NAME, {
      connection: createBullMQRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: false,
      },
    });
  }
  return rewriteQueue;
}
