-- AlterTable: benchmark_videos add customTag and isBringOrder
-- NOTE: customTag and isBringOrder already exist (added via db push), skip

-- AlterTable: benchmark_accounts add isBanned and bannedAt
-- NOTE: bannedAt already exists, only add the missing isBanned column
ALTER TABLE `benchmark_accounts`
  ADD COLUMN `isBanned` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex benchmark_videos (already exists, skip)

-- CreateIndex benchmark_accounts
CREATE INDEX `benchmark_accounts_organizationId_isBanned_bannedAt_idx` ON `benchmark_accounts`(`organizationId`, `isBanned`, `bannedAt`);
