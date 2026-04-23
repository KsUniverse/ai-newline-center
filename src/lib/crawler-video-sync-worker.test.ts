import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  processCrawlerVideoSyncJobMock,
  workerHandlers,
  workerState,
} = vi.hoisted(() => ({
  processCrawlerVideoSyncJobMock: vi.fn(),
  workerHandlers: new Map<string, (job: unknown, error: unknown) => unknown>(),
  workerState: {
    processFn: null as null | ((job: unknown) => Promise<unknown>),
  },
}));

const envMock = {
  CRAWLER_VIDEO_SYNC_WORKER_CONCURRENCY: 3,
  REDIS_URL: "redis://127.0.0.1:6379",
};

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

vi.mock("@/lib/redis", () => ({
  createBullMQRedisConnection: vi.fn(() => ({ mocked: true })),
}));

vi.mock("@/server/services/sync.service", () => ({
  syncService: {
    processCrawlerVideoSyncJob: processCrawlerVideoSyncJobMock,
  },
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(_name: string, processFn: (job: unknown) => Promise<unknown>) {
      workerState.processFn = processFn;
    }

    on(event: string, handler: (job: unknown, error: unknown) => unknown) {
      workerHandlers.set(event, handler);
      return this;
    }
  },
}));

describe("startCrawlerVideoSyncWorker", () => {
  beforeEach(() => {
    vi.resetModules();
    processCrawlerVideoSyncJobMock.mockReset();
    workerHandlers.clear();
    workerState.processFn = null;
    globalThis.__crawlerVideoSyncWorkerInitialized = false;
    envMock.REDIS_URL = "redis://127.0.0.1:6379";
    envMock.CRAWLER_VIDEO_SYNC_WORKER_CONCURRENCY = 3;
  });

  it("processes queued crawler video sync jobs through syncService", async () => {
    const { startCrawlerVideoSyncWorker } = await import("@/lib/crawler-video-sync-worker");

    startCrawlerVideoSyncWorker();
    expect(workerState.processFn).toBeTypeOf("function");

    await workerState.processFn?.({
      id: "job_1",
      data: {
        accountType: "BENCHMARK_ACCOUNT",
        accountId: "benchmark_1",
        organizationId: "org_1",
      },
    });

    expect(processCrawlerVideoSyncJobMock).toHaveBeenCalledWith({
      accountType: "BENCHMARK_ACCOUNT",
      accountId: "benchmark_1",
      organizationId: "org_1",
    });
  });
});
