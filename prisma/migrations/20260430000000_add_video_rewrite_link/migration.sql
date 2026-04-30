-- CreateTable
CREATE TABLE `video_rewrite_links` (
    `id` VARCHAR(191) NOT NULL,
    `videoId` VARCHAR(191) NOT NULL,
    `rewriteId` VARCHAR(191) NOT NULL,
    `linkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `video_rewrite_links_videoId_key`(`videoId`),
    INDEX `video_rewrite_links_rewriteId_idx`(`rewriteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `video_rewrite_links` ADD CONSTRAINT `video_rewrite_links_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `douyin_videos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_rewrite_links` ADD CONSTRAINT `video_rewrite_links_rewriteId_fkey` FOREIGN KEY (`rewriteId`) REFERENCES `rewrites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
