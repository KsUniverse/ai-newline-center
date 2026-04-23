import { describe, expect, it } from "vitest";
import { vi } from "vitest";

import {
  applySyncFailure,
  applySyncSuccess,
  calculateNextSyncPlan,
  defaultPublishWindows,
  learnPublishWindowsFromHistory,
  type AccountVideoSyncProfileState,
} from "@/server/services/account-video-sync-profile.service";

function createProfile(
  overrides: Partial<AccountVideoSyncProfileState> = {},
): AccountVideoSyncProfileState {
  return {
    accountType: "BENCHMARK_ACCOUNT",
    accountId: "account_1",
    organizationId: "org_1",
    status: "ACTIVE",
    priority: 0,
    lastVideoPublishedAt: null,
    lastSyncAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastAttemptAt: null,
    nextSyncAt: null,
    cooldownUntil: null,
    fastFollowUntil: null,
    consecutiveFailureCount: 0,
    consecutiveNoNewCount: 0,
    publishWindows: defaultPublishWindows(),
    hourlyDistribution: [],
    notes: null,
    ...overrides,
  };
}

describe("learnPublishWindowsFromHistory", () => {
  it("falls back to the default windows when history is too sparse", () => {
    const windows = learnPublishWindowsFromHistory([
      new Date("2026-04-01T08:05:00+08:00"),
      new Date("2026-04-03T12:10:00+08:00"),
      new Date("2026-04-05T19:20:00+08:00"),
      new Date("2026-04-07T08:40:00+08:00"),
    ]);

    expect(windows).toEqual(defaultPublishWindows());
  });

  it("learns up to three clustered publish windows from recent history", () => {
    const windows = learnPublishWindowsFromHistory([
      new Date("2026-04-01T08:10:00+08:00"),
      new Date("2026-04-02T09:20:00+08:00"),
      new Date("2026-04-03T08:45:00+08:00"),
      new Date("2026-04-04T12:05:00+08:00"),
      new Date("2026-04-05T12:40:00+08:00"),
      new Date("2026-04-06T19:00:00+08:00"),
      new Date("2026-04-07T19:25:00+08:00"),
    ]);

    expect(windows).toHaveLength(3);
    expect(windows).toEqual([
      expect.objectContaining({
        startMinuteOfDay: 8 * 60,
        endMinuteOfDay: 10 * 60 - 1,
      }),
      expect.objectContaining({
        startMinuteOfDay: 12 * 60,
        endMinuteOfDay: 13 * 60 - 1,
      }),
      expect.objectContaining({
        startMinuteOfDay: 19 * 60,
        endMinuteOfDay: 20 * 60 - 1,
      }),
    ]);
  });
});

describe("calculateNextSyncPlan", () => {
  it("uses a 10 minute cadence inside the pre-window hot zone", () => {
    const result = calculateNextSyncPlan(
      createProfile(),
      new Date("2026-04-21T05:45:00+08:00"),
    );

    expect(result.status).toBe("ACTIVE");
    expect(result.intervalMinutes).toBe(10);
    expect(result.priority).toBeGreaterThanOrEqual(80);
    expect(result.nextSyncAt.toISOString()).toBe(
      new Date("2026-04-21T05:55:00+08:00").toISOString(),
    );
  });

  it("slows to an hourly cadence right after a new video when the next publish window is still far away", () => {
    const result = calculateNextSyncPlan(
      createProfile({
        fastFollowUntil: new Date("2026-04-21T17:00:00+08:00"),
      }),
      new Date("2026-04-21T15:20:00+08:00"),
    );

    expect(result.status).toBe("ACTIVE");
    expect(result.intervalMinutes).toBe(60);
    expect(result.priority).toBe(60);
    expect(result.nextSyncAt.toISOString()).toBe(
      new Date("2026-04-21T16:20:00+08:00").toISOString(),
    );
  });

  it("ramps up to a 30 minute cadence when the next publish window is within an hour", () => {
    const result = calculateNextSyncPlan(
      createProfile({
        fastFollowUntil: new Date("2026-04-21T12:30:00+08:00"),
      }),
      new Date("2026-04-21T10:20:00+08:00"),
    );

    expect(result.status).toBe("ACTIVE");
    expect(result.intervalMinutes).toBe(30);
    expect(result.priority).toBe(80);
    expect(result.nextSyncAt.toISOString()).toBe(
      new Date("2026-04-21T10:50:00+08:00").toISOString(),
    );
  });

  it("adds bounded production jitter to active cadence while keeping the base interval", () => {
    vi.stubEnv("NODE_ENV", "production");
    const randomSpy = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0);

    const result = calculateNextSyncPlan(
      createProfile({
        fastFollowUntil: new Date("2026-04-21T17:00:00+08:00"),
      }),
      new Date("2026-04-21T15:20:00+08:00"),
    );

    expect(result.intervalMinutes).toBe(60);
    expect(result.nextSyncAt.toISOString()).toBe(
      new Date("2026-04-21T16:31:00+08:00").toISOString(),
    );

    randomSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("drops to daily sync for accounts inactive for 30 days", () => {
    const result = calculateNextSyncPlan(
      createProfile({
        lastVideoPublishedAt: new Date("2026-03-10T08:00:00+08:00"),
      }),
      new Date("2026-04-21T09:45:00+08:00"),
    );

    expect(result.status).toBe("LOW_ACTIVITY");
    expect(result.intervalMinutes).toBe(24 * 60);
    expect(result.nextSyncAt.toISOString()).toBe(
      new Date("2026-04-22T09:45:00+08:00").toISOString(),
    );
  });
});

describe("applySyncFailure", () => {
  it("enters cooldown after the fifth consecutive risk failure", () => {
    const result = applySyncFailure(
      createProfile({
        consecutiveFailureCount: 4,
      }),
      new Date("2026-04-21T21:00:00+08:00"),
    );

    expect(result.status).toBe("COOLDOWN");
    expect(result.consecutiveFailureCount).toBe(5);
    expect(result.cooldownUntil?.toISOString()).toBe(
      new Date("2026-04-22T00:00:00+08:00").toISOString(),
    );
    expect(result.nextSyncAt?.toISOString()).toBe(
      new Date("2026-04-22T00:00:00+08:00").toISOString(),
    );
  });
});

describe("applySyncSuccess", () => {
  it("opens a temporary window after two out-of-window discoveries in the same hour", () => {
    const firstPass = applySyncSuccess(
      createProfile({
        publishWindows: [
          {
            startMinuteOfDay: 7 * 60,
            endMinuteOfDay: 9 * 60 + 30,
            source: "default",
            weight: 1,
          },
        ],
      }),
      {
        now: new Date("2026-04-21T15:20:00+08:00"),
        newestVideoPublishedAt: new Date("2026-04-21T15:05:00+08:00"),
        discoveredVideoPublishedAts: [new Date("2026-04-21T15:05:00+08:00")],
      },
    );

    const secondPass = applySyncSuccess(firstPass, {
      now: new Date("2026-04-22T15:25:00+08:00"),
      newestVideoPublishedAt: new Date("2026-04-22T15:10:00+08:00"),
      discoveredVideoPublishedAts: [new Date("2026-04-22T15:10:00+08:00")],
    });

    expect(
      secondPass.publishWindows.find((window) => window.source === "temporary"),
    ).toEqual(
      expect.objectContaining({
        startMinuteOfDay: 15 * 60,
        endMinuteOfDay: 16 * 60 - 1,
      }),
    );
    expect(secondPass.fastFollowUntil?.toISOString()).toBe(
      new Date("2026-04-22T17:25:00+08:00").toISOString(),
    );
    expect(secondPass.consecutiveNoNewCount).toBe(0);
  });
});
