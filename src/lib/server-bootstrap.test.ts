import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  startCrawlerVideoSyncWorkerMock,
  startRewriteWorkerMock,
  startSchedulerMock,
  startTranscriptionWorkerMock,
  startVideoSyncSchedulerMock,
} = vi.hoisted(() => ({
  startCrawlerVideoSyncWorkerMock: vi.fn(),
  startRewriteWorkerMock: vi.fn(),
  startSchedulerMock: vi.fn(),
  startTranscriptionWorkerMock: vi.fn(),
  startVideoSyncSchedulerMock: vi.fn(),
}));

vi.mock("@/lib/scheduler", () => ({
  startScheduler: startSchedulerMock,
}));

vi.mock("@/lib/transcription-worker", () => ({
  startTranscriptionWorker: startTranscriptionWorkerMock,
}));

vi.mock("@/lib/rewrite-worker", () => ({
  startRewriteWorker: startRewriteWorkerMock,
}));

vi.mock("@/lib/crawler-video-sync-worker", () => ({
  startCrawlerVideoSyncWorker: startCrawlerVideoSyncWorkerMock,
}));

vi.mock("@/lib/video-sync-scheduler", () => ({
  startVideoSyncScheduler: startVideoSyncSchedulerMock,
}));

describe("ensureServerBootstrap", () => {
  beforeEach(async () => {
    vi.resetModules();
    startSchedulerMock.mockReset();
    startTranscriptionWorkerMock.mockReset();
    startCrawlerVideoSyncWorkerMock.mockReset();
    startRewriteWorkerMock.mockReset();
    startVideoSyncSchedulerMock.mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "development");

    const { resetServerBootstrapForTests } = await import("@/lib/server-bootstrap");
    resetServerBootstrapForTests();
  });

  it("skips scheduler outside production but still starts the worker only once", async () => {
    const { ensureServerBootstrap } = await import("@/lib/server-bootstrap");

    await ensureServerBootstrap();
    await ensureServerBootstrap();

    expect(startSchedulerMock).not.toHaveBeenCalled();
    expect(startVideoSyncSchedulerMock).not.toHaveBeenCalled();
    expect(startTranscriptionWorkerMock).toHaveBeenCalledTimes(1);
    expect(startRewriteWorkerMock).toHaveBeenCalledTimes(1);
    expect(startCrawlerVideoSyncWorkerMock).toHaveBeenCalledTimes(1);
  });

  it("starts the scheduler in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { resetServerBootstrapForTests, ensureServerBootstrap } = await import(
      "@/lib/server-bootstrap"
    );
    resetServerBootstrapForTests();

    await ensureServerBootstrap();

    expect(startSchedulerMock).toHaveBeenCalledTimes(1);
    expect(startVideoSyncSchedulerMock).toHaveBeenCalledTimes(1);
    expect(startTranscriptionWorkerMock).toHaveBeenCalledTimes(1);
    expect(startRewriteWorkerMock).toHaveBeenCalledTimes(1);
    expect(startCrawlerVideoSyncWorkerMock).toHaveBeenCalledTimes(1);
  });

  it("skips bootstrap in test mode", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { resetServerBootstrapForTests, ensureServerBootstrap } = await import(
      "@/lib/server-bootstrap"
    );
    resetServerBootstrapForTests();

    await ensureServerBootstrap();

    expect(startSchedulerMock).not.toHaveBeenCalled();
    expect(startVideoSyncSchedulerMock).not.toHaveBeenCalled();
    expect(startTranscriptionWorkerMock).not.toHaveBeenCalled();
    expect(startRewriteWorkerMock).not.toHaveBeenCalled();
    expect(startCrawlerVideoSyncWorkerMock).not.toHaveBeenCalled();
  });
});
