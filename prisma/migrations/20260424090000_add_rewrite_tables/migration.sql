-- CreateTable
CREATE TABLE `rewrites` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `targetAccountId` VARCHAR(191) NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `rewrites_workspaceId_key`(`workspaceId`),
    INDEX `rewrites_organizationId_idx`(`organizationId`),
    INDEX `rewrites_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rewrite_versions` (
    `id` VARCHAR(191) NOT NULL,
    `rewriteId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `generatedContent` TEXT NULL,
    `editedContent` TEXT NULL,
    `modelConfigId` VARCHAR(191) NULL,
    `usedFragmentIds` JSON NOT NULL,
    `userInputContent` TEXT NULL,
    `status` ENUM('GENERATING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'GENERATING',
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `rewrite_versions_rewriteId_versionNumber_key`(`rewriteId`, `versionNumber`),
    INDEX `rewrite_versions_rewriteId_idx`(`rewriteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rewrites` ADD CONSTRAINT `rewrites_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `ai_workspaces`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rewrites` ADD CONSTRAINT `rewrites_targetAccountId_fkey` FOREIGN KEY (`targetAccountId`) REFERENCES `douyin_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rewrites` ADD CONSTRAINT `rewrites_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rewrites` ADD CONSTRAINT `rewrites_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rewrite_versions` ADD CONSTRAINT `rewrite_versions_rewriteId_fkey` FOREIGN KEY (`rewriteId`) REFERENCES `rewrites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rewrite_versions` ADD CONSTRAINT `rewrite_versions_modelConfigId_fkey` FOREIGN KEY (`modelConfigId`) REFERENCES `ai_model_configs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
