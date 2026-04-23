import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  scheduleMock,
  envMock,
  runCollectionSyncMock,
  runAccountInfoBatchSyncMock,
  runVideoSnapshotCollectionMock,
} = vi.hoisted(() => ({
  scheduleMock: vi.fn(),
  envMock: {
    ACCOUNT_SYNC_CRON: undefined as string | undefined,
    COLLECTION_SYNC_CRON: undefined as string | undefined,
    VIDEO_SNAPSHOT_CRON: undefined as string | undefined,
  },
  runCollectionSyncMock: vi.fn(),
  runAccountInfoBatchSyncMock: vi.fn(),
  runVideoSnapshotCollectionMock: vi.fn(),
}));

vi.mock("node-cron", () => ({
  default: {
    schedule: scheduleMock,
  },
}));

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

vi.mock("@/server/services/sync.service", () => ({
  syncService: {
    runCollectionSync: runCollectionSyncMock,
    runAccountInfoBatchSync: runAccountInfoBatchSyncMock,
    runVideoSnapshotCollection: runVideoSnapshotCollectionMock,
  },
}));

describe("startScheduler", () => {
  beforeEach(() => {
    scheduleMock.mockReset();
    runCollectionSyncMock.mockReset();
    runAccountInfoBatchSyncMock.mockReset();
    runVideoSnapshotCollectionMock.mockReset();
    runCollectionSyncMock.mockResolvedValue(undefined);
    runAccountInfoBatchSyncMock.mockResolvedValue(undefined);
    runVideoSnapshotCollectionMock.mockResolvedValue(undefined);
    envMock.ACCOUNT_SYNC_CRON = undefined;
    envMock.COLLECTION_SYNC_CRON = undefined;
    envMock.VIDEO_SNAPSHOT_CRON = undefined;
    globalThis.__schedulerInitialized = undefined;
    vi.resetModules();
  });

  it("registers cron jobs only once", async () => {
    const { startScheduler } = await import("@/lib/scheduler");

    startScheduler();
    startScheduler();

    expect(scheduleMock).toHaveBeenCalledTimes(3);
    expect(scheduleMock).toHaveBeenNthCalledWith(1, "3 * * * *", expect.any(Function));
    expect(scheduleMock).toHaveBeenNthCalledWith(2, "*/10 * * * *", expect.any(Function));
    expect(scheduleMock).toHaveBeenNthCalledWith(3, "*/15 * * * *", expect.any(Function));
  });

  it("skips collection sync reentry while the previous run is still active", async () => {
    let resolveRun: (() => void) | undefined;
    runCollectionSyncMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRun = resolve;
      }),
    );
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();

    const collectionHandler = scheduleMock.mock.calls[2]?.[1] as (() => void) | undefined;

    collectionHandler?.();
    collectionHandler?.();

    expect(runCollectionSyncMock).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[Scheduler] Collection sync already running, skipping...",
    );

    resolveRun?.();
    await Promise.resolve();
    consoleWarnSpy.mockRestore();
  });

  it("skips account sync reentry while the previous run is still active", async () => {
    let resolveRun: (() => void) | undefined;
    runAccountInfoBatchSyncMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRun = resolve;
      }),
    );
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();

    const accountHandler = scheduleMock.mock.calls[0]?.[1] as (() => void) | undefined;

    accountHandler?.();
    accountHandler?.();

    expect(runAccountInfoBatchSyncMock).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[Scheduler] Account sync already running, skipping...",
    );

    resolveRun?.();
    await Promise.resolve();
    consoleWarnSpy.mockRestore();
  });
});
