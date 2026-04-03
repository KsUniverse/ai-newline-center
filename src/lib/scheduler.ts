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
  let collectionSyncRunning = false;

  cron.schedule(accountSyncCron, () => {
    void syncService.runAccountInfoBatchSync();
  });

  cron.schedule(videoSyncCron, () => {
    void syncService.runVideoBatchSync();
  });

  cron.schedule(videoSnapshotCron, () => {
    void syncService.runVideoSnapshotCollection();
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
