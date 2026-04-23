CREATE TABLE `account_video_sync_profiles` (
    `accountType` ENUM('MY_ACCOUNT', 'BENCHMARK_ACCOUNT') NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'COOLDOWN', 'LOW_ACTIVITY', 'STOPPED_BANNED') NOT NULL DEFAULT 'ACTIVE',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `lastVideoPublishedAt` DATETIME(3) NULL,
    `lastAttemptAt` DATETIME(3) NULL,
    `lastSuccessAt` DATETIME(3) NULL,
    `lastFailureAt` DATETIME(3) NULL,
    `nextSyncAt` DATETIME(3) NULL,
    `cooldownUntil` DATETIME(3) NULL,
    `fastFollowUntil` DATETIME(3) NULL,
    `consecutiveFailureCount` INTEGER NOT NULL DEFAULT 0,
    `consecutiveNoNewCount` INTEGER NOT NULL DEFAULT 0,
    `publishWindowsJson` JSON NOT NULL,
    `hourlyDistributionJson` JSON NOT NULL,
    `notes` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`accountType`, `accountId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `account_video_sync_profiles_organizationId_status_idx`
    ON `account_video_sync_profiles`(`organizationId`, `status`);

CREATE INDEX `account_video_sync_profiles_nextSyncAt_status_priority_idx`
    ON `account_video_sync_profiles`(`nextSyncAt`, `status`, `priority`);

ALTER TABLE `account_video_sync_profiles`
    ADD CONSTRAINT `account_video_sync_profiles_organizationId_fkey`
    FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `account_video_sync_profiles` (
    `accountType`,
    `accountId`,
    `organizationId`,
    `status`,
    `priority`,
    `lastVideoPublishedAt`,
    `nextSyncAt`,
    `publishWindowsJson`,
    `hourlyDistributionJson`,
    `createdAt`,
    `updatedAt`
)
SELECT
    'MY_ACCOUNT' AS `accountType`,
    a.`id` AS `accountId`,
    a.`organizationId`,
    'ACTIVE' AS `status`,
    0 AS `priority`,
    (
        SELECT MAX(v.`publishedAt`)
        FROM `douyin_videos` v
        WHERE v.`accountId` = a.`id`
          AND v.`deletedAt` IS NULL
    ) AS `lastVideoPublishedAt`,
    NOW(3) AS `nextSyncAt`,
    JSON_ARRAY(
        JSON_OBJECT('startMinuteOfDay', 420, 'endMinuteOfDay', 570, 'source', 'default', 'weight', 1),
        JSON_OBJECT('startMinuteOfDay', 660, 'endMinuteOfDay', 810, 'source', 'default', 'weight', 1),
        JSON_OBJECT('startMinuteOfDay', 1080, 'endMinuteOfDay', 1290, 'source', 'default', 'weight', 1)
    ) AS `publishWindowsJson`,
    JSON_ARRAY() AS `hourlyDistributionJson`,
    NOW(3) AS `createdAt`,
    NOW(3) AS `updatedAt`
FROM `douyin_accounts` a
WHERE a.`deletedAt` IS NULL;

INSERT INTO `account_video_sync_profiles` (
    `accountType`,
    `accountId`,
    `organizationId`,
    `status`,
    `priority`,
    `lastVideoPublishedAt`,
    `nextSyncAt`,
    `publishWindowsJson`,
    `hourlyDistributionJson`,
    `createdAt`,
    `updatedAt`
)
SELECT
    'BENCHMARK_ACCOUNT' AS `accountType`,
    a.`id` AS `accountId`,
    a.`organizationId`,
    IF(a.`bannedAt` IS NULL, 'ACTIVE', 'STOPPED_BANNED') AS `status`,
    0 AS `priority`,
    (
        SELECT MAX(v.`publishedAt`)
        FROM `benchmark_videos` v
        WHERE v.`accountId` = a.`id`
          AND v.`deletedAt` IS NULL
    ) AS `lastVideoPublishedAt`,
    IF(a.`bannedAt` IS NULL, NOW(3), NULL) AS `nextSyncAt`,
    JSON_ARRAY(
        JSON_OBJECT('startMinuteOfDay', 420, 'endMinuteOfDay', 570, 'source', 'default', 'weight', 1),
        JSON_OBJECT('startMinuteOfDay', 660, 'endMinuteOfDay', 810, 'source', 'default', 'weight', 1),
        JSON_OBJECT('startMinuteOfDay', 1080, 'endMinuteOfDay', 1290, 'source', 'default', 'weight', 1)
    ) AS `publishWindowsJson`,
    JSON_ARRAY() AS `hourlyDistributionJson`,
    NOW(3) AS `createdAt`,
    NOW(3) AS `updatedAt`
FROM `benchmark_accounts` a
WHERE a.`deletedAt` IS NULL;
