import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  startSchedulerMock,
  startTranscriptionWorkerMock,
} = vi.hoisted(() => ({
  startSchedulerMock: vi.fn(),
  startTranscriptionWorkerMock: vi.fn(),
}));

vi.mock("@/lib/scheduler", () => ({
  startScheduler: startSchedulerMock,
}));

vi.mock("@/lib/transcription-worker", () => ({
  startTranscriptionWorker: startTranscriptionWorkerMock,
}));

describe("ensureServerBootstrap", () => {
  beforeEach(async () => {
    vi.resetModules();
    startSchedulerMock.mockReset();
    startTranscriptionWorkerMock.mockReset();
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
    expect(startTranscriptionWorkerMock).toHaveBeenCalledTimes(1);
  });

  it("starts the scheduler in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { resetServerBootstrapForTests, ensureServerBootstrap } = await import(
      "@/lib/server-bootstrap"
    );
    resetServerBootstrapForTests();

    await ensureServerBootstrap();

    expect(startSchedulerMock).toHaveBeenCalledTimes(1);
    expect(startTranscriptionWorkerMock).toHaveBeenCalledTimes(1);
  });

  it("skips bootstrap in test mode", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { resetServerBootstrapForTests, ensureServerBootstrap } = await import(
      "@/lib/server-bootstrap"
    );
    resetServerBootstrapForTests();

    await ensureServerBootstrap();

    expect(startSchedulerMock).not.toHaveBeenCalled();
    expect(startTranscriptionWorkerMock).not.toHaveBeenCalled();
  });
});
