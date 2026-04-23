import { Worker } from "bullmq";

import {
  CRAWLER_VIDEO_SYNC_QUEUE_NAME,
  type CrawlerVideoSyncJobData,
} from "@/lib/bullmq";
import { env } from "@/lib/env";
import { createBullMQRedisConnection } from "@/lib/redis";
import { syncService } from "@/server/services/sync.service";

declare global {
  var __crawlerVideoSyncWorkerInitialized: boolean | undefined;
}

export function startCrawlerVideoSyncWorker(): void {
  if (globalThis.__crawlerVideoSyncWorkerInitialized) {
    console.log("[CrawlerVideoSyncWorker] already started, skipping", {
      pid: process.pid,
    });
    return;
  }

  if (!env.REDIS_URL) {
    console.warn("[CrawlerVideoSyncWorker] REDIS_URL not set, worker skipped.");
    return;
  }

  globalThis.__crawlerVideoSyncWorkerInitialized = true;

  const worker = new Worker<CrawlerVideoSyncJobData>(
    CRAWLER_VIDEO_SYNC_QUEUE_NAME,
    async (job) => {
      await syncService.processCrawlerVideoSyncJob(job.data);
    },
    {
      connection: createBullMQRedisConnection(),
      concurrency: env.CRAWLER_VIDEO_SYNC_WORKER_CONCURRENCY,
    },
  );

  worker.on("failed", (job, error) => {
    console.error("[CrawlerVideoSyncWorker] Job failed", {
      jobId: job?.id ?? null,
      accountType: job?.data.accountType ?? null,
      accountId: job?.data.accountId ?? null,
      attemptsMade: job?.attemptsMade ?? null,
      error: error instanceof Error ? error.message : "未知错误",
    });
  });

  console.log("[CrawlerVideoSyncWorker] Worker started.");
}
