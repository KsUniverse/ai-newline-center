-- DropIndex
DROP INDEX `benchmark_accounts_organizationId_isBanned_bannedAt_idx` ON `benchmark_accounts`;

-- AlterTable
ALTER TABLE `benchmark_accounts`
  DROP COLUMN `isBanned`;

-- CreateIndex
CREATE INDEX `benchmark_accounts_organizationId_bannedAt_idx` ON `benchmark_accounts`(`organizationId`, `bannedAt`);
