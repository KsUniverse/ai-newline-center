import cron from "node-cron";

import { env } from "@/lib/env";
import { syncService } from "@/server/services/sync.service";

let initialized = false;

export function startScheduler(): void {
  if (initialized) {
    return;
  }

  initialized = true;

  const accountSyncCron = env.ACCOUNT_SYNC_CRON ?? "0 */6 * * *";
  const videoSyncCron = env.VIDEO_SYNC_CRON ?? "0 * * * *";
  const videoSnapshotCron = env.VIDEO_SNAPSHOT_CRON ?? "*/10 * * * *";
  const collectionSyncCron = env.COLLECTION_SYNC_CRON ?? "*/5 * * * *";
  let accountSyncRunning = false;
  let videoSyncRunning = false;
  let videoSnapshotRunning = false;
  let collectionSyncRunning = false;

  cron.schedule(accountSyncCron, () => {
    if (accountSyncRunning) {
      console.warn("[Scheduler] Account sync already running, skipping...");
      return;
    }

    accountSyncRunning = true;
    void syncService.runAccountInfoBatchSync().finally(() => {
      accountSyncRunning = false;
    });
  });

  cron.schedule(videoSyncCron, () => {
    if (videoSyncRunning) {
      console.warn("[Scheduler] Video sync already running, skipping...");
      return;
    }

    videoSyncRunning = true;
    void syncService.runVideoBatchSync().finally(() => {
      videoSyncRunning = false;
    });
  });

  cron.schedule(videoSnapshotCron, () => {
    if (videoSnapshotRunning) {
      console.warn("[Scheduler] Video snapshot sync already running, skipping...");
      return;
    }

    videoSnapshotRunning = true;
    void syncService.runVideoSnapshotCollection().finally(() => {
      videoSnapshotRunning = false;
    });
  });

  cron.schedule(collectionSyncCron, () => {
    if (collectionSyncRunning) {
      console.warn("[Scheduler] Collection sync already running, skipping...");
      return;
    }

    collectionSyncRunning = true;
    void syncService.runCollectionSync().finally(() => {
      collectionSyncRunning = false;
    });
  });
}
