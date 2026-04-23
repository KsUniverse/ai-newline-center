import { env } from "@/lib/env";
import { syncService } from "@/server/services/sync.service";

declare global {
  var __videoSyncSchedulerInitialized: boolean | undefined;
}

const DEFAULT_IDLE_DELAY_MS = 60_000;
const DEFAULT_RETRY_DELAY_MS = 30_000;
const DEFAULT_DUE_RECHECK_DELAY_MS = 15_000;

interface VideoSyncSchedulerCycleOptions {
  now?: () => Date;
  idleDelayMs?: number;
  retryDelayMs?: number;
  dueRecheckDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runVideoSyncSchedulerCycle(
  options: VideoSyncSchedulerCycleOptions = {},
): Promise<number> {
  const now = options.now?.() ?? new Date();
  const idleDelayMs = options.idleDelayMs ?? DEFAULT_IDLE_DELAY_MS;
  const dueRecheckDelayMs = options.dueRecheckDelayMs ?? DEFAULT_DUE_RECHECK_DELAY_MS;
  const result = await syncService.runVideoSyncPlanner(now);

  if (result.dueProfiles > 0) {
    return dueRecheckDelayMs;
  }

  if (!result.nearestNextSyncAt) {
    return idleDelayMs;
  }

  return Math.max(result.nearestNextSyncAt.getTime() - now.getTime(), 0);
}

async function runVideoSyncSchedulerLoop(): Promise<void> {
  while (globalThis.__videoSyncSchedulerInitialized) {
    try {
      const delayMs = await runVideoSyncSchedulerCycle();
      console.log("[VideoSyncLoop] Waiting for next cycle", {
        delayMs,
      });
      await sleep(delayMs);
    } catch (error) {
      console.error("[VideoSyncLoop] Cycle failed", {
        error,
      });
      await sleep(DEFAULT_RETRY_DELAY_MS);
    }
  }
}

export function startVideoSyncScheduler(): void {
  if (globalThis.__videoSyncSchedulerInitialized) {
    console.log("[VideoSyncLoop] already started, skipping", {
      pid: process.pid,
    });
    return;
  }

  if (!env.REDIS_URL) {
    console.warn("[VideoSyncLoop] REDIS_URL not set, scheduler skipped.");
    return;
  }

  globalThis.__videoSyncSchedulerInitialized = true;
  console.log("[VideoSyncLoop] Scheduler started.", {
    pid: process.pid,
  });

  void runVideoSyncSchedulerLoop().catch((error) => {
    globalThis.__videoSyncSchedulerInitialized = false;
    console.error("[VideoSyncLoop] Scheduler stopped unexpectedly", {
      pid: process.pid,
      error,
    });
  });
}

export function resetVideoSyncSchedulerForTests(): void {
  globalThis.__videoSyncSchedulerInitialized = false;
}
