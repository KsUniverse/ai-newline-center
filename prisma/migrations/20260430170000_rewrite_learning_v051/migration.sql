-- AlterTable
ALTER TABLE `rewrite_versions` ADD COLUMN `learningContextSnapshot` JSON NULL,
    ADD COLUMN `promptTemplateVersion` VARCHAR(191) NULL,
    ADD COLUMN `usedLearningCaseIds` JSON NOT NULL;

-- CreateTable
CREATE TABLE `rewrite_publications` (
    `id` VARCHAR(191) NOT NULL,
    `rewriteVersionId` VARCHAR(191) NOT NULL,
    `rewriteId` VARCHAR(191) NOT NULL,
    `targetAccountId` VARCHAR(191) NOT NULL,
    `publishedVideoId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `linkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('LINKED', 'UNLINKED') NOT NULL DEFAULT 'LINKED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `rewrite_publications_rewriteVersionId_idx`(`rewriteVersionId`),
    INDEX `rewrite_publications_publishedVideoId_idx`(`publishedVideoId`),
    INDEX `rewrite_publications_targetAccountId_status_idx`(`targetAccountId`, `status`),
    INDEX `rewrite_publications_organizationId_status_idx`(`organizationId`, `status`),
    UNIQUE INDEX `rewrite_publications_rewriteVersionId_status_key`(`rewriteVersionId`, `status`),
    UNIQUE INDEX `rewrite_publications_publishedVideoId_status_key`(`publishedVideoId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rewrite_learning_cases` (
    `id` VARCHAR(191) NOT NULL,
    `rewriteVersionId` VARCHAR(191) NOT NULL,
    `rewriteId` VARCHAR(191) NOT NULL,
    `publicationId` VARCHAR(191) NOT NULL,
    `targetAccountId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `sourceBenchmarkVideoId` VARCHAR(191) NULL,
    `sourceTranscriptSnapshot` LONGTEXT NULL,
    `sourceAnnotationsSnapshot` JSON NOT NULL,
    `generatedContentSnapshot` LONGTEXT NULL,
    `editedContentSnapshot` LONGTEXT NULL,
    `finalContentSnapshot` LONGTEXT NOT NULL,
    `usedFragmentSnapshot` JSON NOT NULL,
    `metricsSnapshot` JSON NOT NULL,
    `performanceScore` INTEGER NOT NULL DEFAULT 0,
    `embeddingText` LONGTEXT NULL,
    `embeddingJson` JSON NULL,
    `embeddingStatus` ENUM('PENDING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `rewrite_learning_cases_rewriteVersionId_key`(`rewriteVersionId`),
    UNIQUE INDEX `rewrite_learning_cases_publicationId_key`(`publicationId`),
    INDEX `rewrite_learning_cases_targetAccountId_status_performanceSco_idx`(`targetAccountId`, `status`, `performanceScore`),
    INDEX `rewrite_learning_cases_organizationId_status_idx`(`organizationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `douyin_account_style_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `targetAccountId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `toneKeywords` JSON NOT NULL,
    `structurePatterns` JSON NOT NULL,
    `openingPatterns` JSON NOT NULL,
    `ctaPatterns` JSON NOT NULL,
    `avoidPatterns` JSON NOT NULL,
    `sampleCount` INTEGER NOT NULL DEFAULT 0,
    `lastBuiltAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `douyin_account_style_profiles_targetAccountId_key`(`targetAccountId`),
    INDEX `douyin_account_style_profiles_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rewrite_publications` ADD CONSTRAINT `rewrite_publications_rewriteVersionId_fkey` FOREIGN KEY (`rewriteVersionId`) REFERENCES `rewrite_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `rewrite_publications` ADD CONSTRAINT `rewrite_publications_rewriteId_fkey` FOREIGN KEY (`rewriteId`) REFERENCES `rewrites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `rewrite_publications` ADD CONSTRAINT `rewrite_publications_targetAccountId_fkey` FOREIGN KEY (`targetAccountId`) REFERENCES `douyin_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `rewrite_publications` ADD CONSTRAINT `rewrite_publications_publishedVideoId_fkey` FOREIGN KEY (`publishedVideoId`) REFERENCES `douyin_videos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `rewrite_publications` ADD CONSTRAINT `rewrite_publications_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `rewrite_learning_cases` ADD CONSTRAINT `rewrite_learning_cases_rewriteVersionId_fkey` FOREIGN KEY (`rewriteVersionId`) REFERENCES `rewrite_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `rewrite_learning_cases` ADD CONSTRAINT `rewrite_learning_cases_rewriteId_fkey` FOREIGN KEY (`rewriteId`) REFERENCES `rewrites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `rewrite_learning_cases` ADD CONSTRAINT `rewrite_learning_cases_publicationId_fkey` FOREIGN KEY (`publicationId`) REFERENCES `rewrite_publications`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `rewrite_learning_cases` ADD CONSTRAINT `rewrite_learning_cases_targetAccountId_fkey` FOREIGN KEY (`targetAccountId`) REFERENCES `douyin_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `rewrite_learning_cases` ADD CONSTRAINT `rewrite_learning_cases_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `douyin_account_style_profiles` ADD CONSTRAINT `douyin_account_style_profiles_targetAccountId_fkey` FOREIGN KEY (`targetAccountId`) REFERENCES `douyin_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `douyin_account_style_profiles` ADD CONSTRAINT `douyin_account_style_profiles_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
