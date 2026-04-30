-- CreateTable
CREATE TABLE `style_experiences` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `rewriteId` VARCHAR(191) NOT NULL,
    `videoId` VARCHAR(191) NOT NULL,
    `aiContent` LONGTEXT NOT NULL,
    `finalContent` LONGTEXT NOT NULL,
    `playsCount` INTEGER NOT NULL,
    `likesCount` INTEGER NOT NULL,
    `commentsCount` INTEGER NOT NULL,
    `sharesCount` INTEGER NOT NULL,
    `qualityScore` DOUBLE NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `style_experiences_videoId_key`(`videoId`),
    UNIQUE INDEX `style_experiences_rewriteId_videoId_key`(`rewriteId`, `videoId`),
    INDEX `style_experiences_accountId_qualityScore_idx`(`accountId`, `qualityScore`),
    INDEX `style_experiences_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `style_experiences` ADD CONSTRAINT `style_experiences_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `douyin_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `style_experiences` ADD CONSTRAINT `style_experiences_rewriteId_fkey` FOREIGN KEY (`rewriteId`) REFERENCES `rewrites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `style_experiences` ADD CONSTRAINT `style_experiences_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `douyin_videos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `style_experiences` ADD CONSTRAINT `style_experiences_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
