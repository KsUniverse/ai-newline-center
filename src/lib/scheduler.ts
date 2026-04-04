import cron from "node-cron";

import { env } from "@/lib/env";
import { syncService } from "@/server/services/sync.service";

let initialized = false;

export function startScheduler(): void {
  if (initialized) {
    return;
  }

  initialized = true;

  const accountSyncCron = env.ACCOUNT_SYNC_CRON ?? "0 */1 * * *";
  const videoSyncCron = env.VIDEO_SYNC_CRON ?? "*/10 * * * *";
  const videoSnapshotCron = env.VIDEO_SNAPSHOT_CRON ?? "*/10 * * * *";
  const collectionSyncCron = env.COLLECTION_SYNC_CRON ?? "*/5 * * * *";
  let accountSyncRunning = false;
  let videoSyncRunning = false;
  let videoSnapshotRunning = false;
  let collectionSyncRunning = false;

  console.log(
    `[Scheduler] Initialized: accountSync=${accountSyncCron}, videoSync=${videoSyncCron}, videoSnapshot=${videoSnapshotCron}, collectionSync=${collectionSyncCron}`,
  );

  cron.schedule(accountSyncCron, () => {
    if (accountSyncRunning) {
      console.warn("[Scheduler] Account sync already running, skipping...");
      return;
    }

    accountSyncRunning = true;
    console.log("[Scheduler] Account sync triggered");
    void syncService
      .runAccountInfoBatchSync()
      .then(() => {
        console.log("[Scheduler] Account sync completed");
      })
      .catch((error: unknown) => {
        console.error("[Scheduler] Account sync failed:", error);
      })
      .finally(() => {
        accountSyncRunning = false;
      });
  });

  cron.schedule(videoSyncCron, () => {
    if (videoSyncRunning) {
      console.warn("[Scheduler] Video sync already running, skipping...");
      return;
    }

    videoSyncRunning = true;
    console.log("[Scheduler] Video sync triggered");
    void syncService
      .runVideoBatchSync()
      .then(() => {
        console.log("[Scheduler] Video sync completed");
      })
      .catch((error: unknown) => {
        console.error("[Scheduler] Video sync failed:", error);
      })
      .finally(() => {
        videoSyncRunning = false;
      });
  });

  cron.schedule(videoSnapshotCron, () => {
    if (videoSnapshotRunning) {
      console.warn("[Scheduler] Video snapshot sync already running, skipping...");
      return;
    }

    videoSnapshotRunning = true;
    console.log("[Scheduler] Video snapshot sync triggered");
    void syncService
      .runVideoSnapshotCollection()
      .then(() => {
        console.log("[Scheduler] Video snapshot sync completed");
      })
      .catch((error: unknown) => {
        console.error("[Scheduler] Video snapshot sync failed:", error);
      })
      .finally(() => {
        videoSnapshotRunning = false;
      });
  });

  cron.schedule(collectionSyncCron, () => {
    if (collectionSyncRunning) {
      console.warn("[Scheduler] Collection sync already running, skipping...");
      return;
    }

    collectionSyncRunning = true;
    console.log("[Scheduler] Collection sync triggered");
    void syncService
      .runCollectionSync()
      .then(() => {
        console.log("[Scheduler] Collection sync completed");
      })
      .catch((error: unknown) => {
        console.error("[Scheduler] Collection sync failed:", error);
      })
      .finally(() => {
        collectionSyncRunning = false;
      });
  });
}
