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

export const CRAWLER_VIDEO_SYNC_QUEUE_NAME = "crawler-video-sync";

export interface CrawlerVideoSyncJobData {
  accountType: "MY_ACCOUNT" | "BENCHMARK_ACCOUNT";
  accountId: string;
  organizationId: string;
}

let crawlerVideoSyncQueue: Queue<CrawlerVideoSyncJobData> | null = null;

export function getCrawlerVideoSyncQueue(): Queue<CrawlerVideoSyncJobData> {
  if (!crawlerVideoSyncQueue) {
    crawlerVideoSyncQueue = new Queue<CrawlerVideoSyncJobData>(
      CRAWLER_VIDEO_SYNC_QUEUE_NAME,
      {
        connection: createBullMQRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 15_000 },
          removeOnComplete: { age: 86_400 },
          removeOnFail: false,
        },
      },
    );
  }

  return crawlerVideoSyncQueue;
}
