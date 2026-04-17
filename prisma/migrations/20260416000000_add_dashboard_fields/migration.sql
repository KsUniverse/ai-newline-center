-- CreateEnum
CREATE TABLE IF NOT EXISTS `__prisma_migrations` LIKE `__prisma_migrations`;

-- AlterTable: benchmark_videos add customTag and isBringOrder
ALTER TABLE `benchmark_videos`
  ADD COLUMN `customTag` ENUM('LIMIT_UP','DRAGON_TIGER','OVERNIGHT','DARK_POOL','THEME_REVIEW','THREE_DRAGONS','NOON_REVIEW','RECAP') NULL,
  ADD COLUMN `isBringOrder` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: benchmark_accounts add isBanned and bannedAt
ALTER TABLE `benchmark_accounts`
  ADD COLUMN `isBanned` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `bannedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `benchmark_videos_organizationId_publishedAt_idx` ON `benchmark_videos`(`organizationId`, `publishedAt`);

-- CreateIndex
CREATE INDEX `benchmark_accounts_organizationId_isBanned_bannedAt_idx` ON `benchmark_accounts`(`organizationId`, `isBanned`, `bannedAt`);
