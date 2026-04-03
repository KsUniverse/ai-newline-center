import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  scheduleMock,
  envMock,
  runAccountInfoBatchSyncMock,
  runVideoBatchSyncMock,
  runVideoSnapshotCollectionMock,
} = vi.hoisted(() => ({
  scheduleMock: vi.fn(),
  envMock: {
    ACCOUNT_SYNC_CRON: undefined as string | undefined,
    VIDEO_SYNC_CRON: undefined as string | undefined,
    VIDEO_SNAPSHOT_CRON: undefined as string | undefined,
  },
  runAccountInfoBatchSyncMock: vi.fn(),
  runVideoBatchSyncMock: vi.fn(),
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
    runAccountInfoBatchSync: runAccountInfoBatchSyncMock,
    runVideoBatchSync: runVideoBatchSyncMock,
    runVideoSnapshotCollection: runVideoSnapshotCollectionMock,
  },
}));

describe("startScheduler", () => {
  beforeEach(() => {
    scheduleMock.mockReset();
    runAccountInfoBatchSyncMock.mockReset();
    runVideoBatchSyncMock.mockReset();
    runVideoSnapshotCollectionMock.mockReset();
    envMock.ACCOUNT_SYNC_CRON = undefined;
    envMock.VIDEO_SYNC_CRON = undefined;
    envMock.VIDEO_SNAPSHOT_CRON = undefined;
    vi.resetModules();
  });

  it("registers cron jobs only once", async () => {
    const { startScheduler } = await import("@/lib/scheduler");

    startScheduler();
    startScheduler();

    expect(scheduleMock).toHaveBeenCalledTimes(3);
    expect(scheduleMock).toHaveBeenNthCalledWith(1, "0 */6 * * *", expect.any(Function));
    expect(scheduleMock).toHaveBeenNthCalledWith(2, "0 * * * *", expect.any(Function));
    expect(scheduleMock).toHaveBeenNthCalledWith(3, "*/10 * * * *", expect.any(Function));
  });
});
