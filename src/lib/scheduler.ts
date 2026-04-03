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

  cron.schedule(accountSyncCron, () => {
    void syncService.runAccountInfoBatchSync();
  });

  cron.schedule(videoSyncCron, () => {
    void syncService.runVideoBatchSync();
  });
}
