-- DropIndex
DROP INDEX `benchmark_accounts_organizationId_isBanned_bannedAt_idx` ON `benchmark_accounts`;

-- AlterTable
ALTER TABLE `benchmark_accounts`
  DROP COLUMN `isBanned`;

-- CreateIndex
-- NOTE: benchmark_accounts_organizationId_bannedAt_idx already exists (added via db push), skip
