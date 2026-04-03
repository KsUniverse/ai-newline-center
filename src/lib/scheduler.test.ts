import { beforeEach, describe, expect, it, vi } from "vitest";

const { scheduleMock, envMock, runAccountInfoBatchSyncMock, runVideoBatchSyncMock } = vi.hoisted(
  () => ({
    scheduleMock: vi.fn(),
    envMock: {
      ACCOUNT_SYNC_CRON: undefined as string | undefined,
      VIDEO_SYNC_CRON: undefined as string | undefined,
    },
    runAccountInfoBatchSyncMock: vi.fn(),
    runVideoBatchSyncMock: vi.fn(),
  }),
);

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
  },
}));

describe("startScheduler", () => {
  beforeEach(() => {
    scheduleMock.mockReset();
    runAccountInfoBatchSyncMock.mockReset();
    runVideoBatchSyncMock.mockReset();
    envMock.ACCOUNT_SYNC_CRON = undefined;
    envMock.VIDEO_SYNC_CRON = undefined;
    vi.resetModules();
  });

  it("registers cron jobs only once", async () => {
    const { startScheduler } = await import("@/lib/scheduler");

    startScheduler();
    startScheduler();

    expect(scheduleMock).toHaveBeenCalledTimes(2);
    expect(scheduleMock).toHaveBeenNthCalledWith(1, "0 */6 * * *", expect.any(Function));
    expect(scheduleMock).toHaveBeenNthCalledWith(2, "0 * * * *", expect.any(Function));
  });
});
