import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  runVideoSyncPlannerMock,
} = vi.hoisted(() => ({
  runVideoSyncPlannerMock: vi.fn(),
}));

vi.mock("@/server/services/sync.service", () => ({
  syncService: {
    runVideoSyncPlanner: runVideoSyncPlannerMock,
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    REDIS_URL: "redis://127.0.0.1:6379",
  },
}));

describe("runVideoSyncSchedulerCycle", () => {
  beforeEach(() => {
    vi.resetModules();
    runVideoSyncPlannerMock.mockReset();
  });

  it("returns the exact wait time until the nearest scheduled profile", async () => {
    const now = new Date("2026-04-23T09:00:00.000Z");
    const nearestNextSyncAt = new Date("2026-04-23T09:02:30.000Z");
    runVideoSyncPlannerMock.mockResolvedValue({
      dueProfiles: 0,
      enqueuedJobs: 0,
      skippedProfiles: 0,
      nearestNextSyncAt,
    });

    const { runVideoSyncSchedulerCycle } = await import("@/lib/video-sync-scheduler");
    const result = await runVideoSyncSchedulerCycle({
      now: () => now,
      idleDelayMs: 60_000,
      retryDelayMs: 30_000,
    });

    expect(runVideoSyncPlannerMock).toHaveBeenCalledWith(now);
    expect(result).toBe(150_000);
  });

  it("rechecks shortly after due profiles were enqueued", async () => {
    const now = new Date("2026-04-23T09:00:00.000Z");
    runVideoSyncPlannerMock.mockResolvedValue({
      dueProfiles: 12,
      enqueuedJobs: 12,
      skippedProfiles: 0,
      nearestNextSyncAt: new Date("2026-04-23T09:30:00.000Z"),
    });

    const { runVideoSyncSchedulerCycle } = await import("@/lib/video-sync-scheduler");
    const result = await runVideoSyncSchedulerCycle({
      now: () => now,
      idleDelayMs: 60_000,
      retryDelayMs: 30_000,
    });

    expect(result).toBe(15_000);
  });

  it("falls back to the idle delay when there is no nearest execution time", async () => {
    const now = new Date("2026-04-23T09:00:00.000Z");
    runVideoSyncPlannerMock.mockResolvedValue({
      dueProfiles: 0,
      enqueuedJobs: 0,
      skippedProfiles: 0,
      nearestNextSyncAt: null,
    });

    const { runVideoSyncSchedulerCycle } = await import("@/lib/video-sync-scheduler");
    const result = await runVideoSyncSchedulerCycle({
      now: () => now,
      idleDelayMs: 60_000,
      retryDelayMs: 30_000,
    });

    expect(result).toBe(60_000);
  });
});
