-- CreateTable
CREATE TABLE `organizations` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('GROUP', 'BRANCH') NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `parentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `account` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'BRANCH_MANAGER', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    `organizationId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `users_account_key`(`account`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `douyin_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `profileUrl` VARCHAR(191) NOT NULL,
    `secUserId` VARCHAR(191) NULL,
    `nickname` VARCHAR(191) NOT NULL,
    `avatar` TEXT NOT NULL,
    `bio` TEXT NULL,
    `signature` TEXT NULL,
    `followersCount` INTEGER NOT NULL DEFAULT 0,
    `followingCount` INTEGER NOT NULL DEFAULT 0,
    `likesCount` INTEGER NOT NULL DEFAULT 0,
    `videosCount` INTEGER NOT NULL DEFAULT 0,
    `douyinNumber` VARCHAR(191) NULL,
    `ipLocation` VARCHAR(191) NULL,
    `age` INTEGER NULL,
    `province` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `verificationLabel` VARCHAR(191) NULL,
    `verificationIconUrl` TEXT NULL,
    `verificationType` INTEGER NULL,
    `loginStatus` ENUM('NOT_LOGGED_IN', 'PENDING', 'LOGGED_IN', 'EXPIRED', 'FAILED') NOT NULL DEFAULT 'NOT_LOGGED_IN',
    `loginStatePath` TEXT NULL,
    `loginStateUpdatedAt` DATETIME(3) NULL,
    `loginStateCheckedAt` DATETIME(3) NULL,
    `loginStateExpiresAt` DATETIME(3) NULL,
    `loginErrorMessage` TEXT NULL,
    `favoriteCookieHeader` LONGTEXT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `douyin_accounts_profileUrl_key`(`profileUrl`),
    UNIQUE INDEX `douyin_accounts_secUserId_key`(`secUserId`),
    INDEX `douyin_accounts_userId_idx`(`userId`),
    INDEX `douyin_accounts_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `benchmark_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `profileUrl` VARCHAR(191) NOT NULL,
    `secUserId` VARCHAR(191) NULL,
    `nickname` VARCHAR(191) NOT NULL,
    `avatar` TEXT NOT NULL,
    `bio` TEXT NULL,
    `signature` TEXT NULL,
    `followersCount` INTEGER NOT NULL DEFAULT 0,
    `followingCount` INTEGER NOT NULL DEFAULT 0,
    `likesCount` INTEGER NOT NULL DEFAULT 0,
    `videosCount` INTEGER NOT NULL DEFAULT 0,
    `douyinNumber` VARCHAR(191) NULL,
    `ipLocation` VARCHAR(191) NULL,
    `age` INTEGER NULL,
    `province` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `verificationLabel` VARCHAR(191) NULL,
    `verificationIconUrl` TEXT NULL,
    `verificationType` INTEGER NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `benchmark_accounts_createdByUserId_idx`(`createdByUserId`),
    INDEX `benchmark_accounts_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `benchmark_accounts_organizationId_profileUrl_key`(`organizationId`, `profileUrl`),
    UNIQUE INDEX `benchmark_accounts_organizationId_secUserId_key`(`organizationId`, `secUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `benchmark_account_members` (
    `id` VARCHAR(191) NOT NULL,
    `benchmarkAccountId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `source` ENUM('MANUAL', 'COLLECTION_SYNC') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `benchmark_account_members_organizationId_idx`(`organizationId`),
    INDEX `benchmark_account_members_userId_idx`(`userId`),
    UNIQUE INDEX `benchmark_account_members_benchmarkAccountId_userId_key`(`benchmarkAccountId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_collection_videos` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `awemeId` VARCHAR(191) NOT NULL,
    `authorSecUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `employee_collection_videos_accountId_createdAt_idx`(`accountId`, `createdAt`),
    UNIQUE INDEX `employee_collection_videos_accountId_awemeId_key`(`accountId`, `awemeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `douyin_login_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NULL,
    `purpose` ENUM('CREATE_ACCOUNT', 'RELOGIN') NOT NULL,
    `status` ENUM('CREATED', 'QRCODE_READY', 'SCANNED', 'CONFIRMED', 'SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'CREATED',
    `qrcodeDataUrl` LONGTEXT NULL,
    `resolvedSecUserId` VARCHAR(191) NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `expiresAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `douyin_login_sessions_userId_idx`(`userId`),
    INDEX `douyin_login_sessions_organizationId_idx`(`organizationId`),
    INDEX `douyin_login_sessions_accountId_idx`(`accountId`),
    INDEX `douyin_login_sessions_organizationId_status_idx`(`organizationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `douyin_videos` (
    `id` VARCHAR(191) NOT NULL,
    `videoId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `title` TEXT NOT NULL,
    `shareUrl` TEXT NULL,
    `coverUrl` TEXT NULL,
    `coverSourceUrl` TEXT NULL,
    `coverStoragePath` TEXT NULL,
    `videoUrl` TEXT NULL,
    `videoSourceUrl` TEXT NULL,
    `videoStoragePath` TEXT NULL,
    `publishedAt` DATETIME(3) NULL,
    `playCount` INTEGER NOT NULL DEFAULT 0,
    `likeCount` INTEGER NOT NULL DEFAULT 0,
    `commentCount` INTEGER NOT NULL DEFAULT 0,
    `shareCount` INTEGER NOT NULL DEFAULT 0,
    `collectCount` INTEGER NOT NULL DEFAULT 0,
    `admireCount` INTEGER NOT NULL DEFAULT 0,
    `recommendCount` INTEGER NOT NULL DEFAULT 0,
    `tags` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `douyin_videos_videoId_key`(`videoId`),
    INDEX `douyin_videos_accountId_idx`(`accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `benchmark_videos` (
    `id` VARCHAR(191) NOT NULL,
    `videoId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `title` TEXT NOT NULL,
    `shareUrl` TEXT NULL,
    `coverUrl` TEXT NULL,
    `coverSourceUrl` TEXT NULL,
    `coverStoragePath` TEXT NULL,
    `videoUrl` TEXT NULL,
    `videoSourceUrl` TEXT NULL,
    `videoStoragePath` TEXT NULL,
    `publishedAt` DATETIME(3) NULL,
    `playCount` INTEGER NOT NULL DEFAULT 0,
    `likeCount` INTEGER NOT NULL DEFAULT 0,
    `commentCount` INTEGER NOT NULL DEFAULT 0,
    `shareCount` INTEGER NOT NULL DEFAULT 0,
    `collectCount` INTEGER NOT NULL DEFAULT 0,
    `admireCount` INTEGER NOT NULL DEFAULT 0,
    `recommendCount` INTEGER NOT NULL DEFAULT 0,
    `tags` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `benchmark_videos_accountId_idx`(`accountId`),
    INDEX `benchmark_videos_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `benchmark_videos_accountId_videoId_key`(`accountId`, `videoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `video_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `videoId` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `playsCount` INTEGER NOT NULL,
    `likesCount` INTEGER NOT NULL,
    `commentsCount` INTEGER NOT NULL,
    `sharesCount` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `video_snapshots_videoId_idx`(`videoId`),
    INDEX `video_snapshots_videoId_timestamp_idx`(`videoId`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `benchmark_video_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `videoId` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `playsCount` INTEGER NOT NULL,
    `likesCount` INTEGER NOT NULL,
    `commentsCount` INTEGER NOT NULL,
    `sharesCount` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `benchmark_video_snapshots_videoId_idx`(`videoId`),
    INDEX `benchmark_video_snapshots_videoId_timestamp_idx`(`videoId`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_model_configs` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `baseUrl` TEXT NOT NULL,
    `apiKey` TEXT NOT NULL,
    `modelName` VARCHAR(191) NOT NULL,
    `videoInputMode` ENUM('NONE', 'DASHSCOPE_FILE', 'GOOGLE_FILE') NOT NULL DEFAULT 'NONE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_step_bindings` (
    `id` VARCHAR(191) NOT NULL,
    `step` ENUM('TRANSCRIBE', 'DECOMPOSE', 'REWRITE') NOT NULL,
    `modelConfigId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_step_bindings_step_key`(`step`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_workspaces` (
    `id` VARCHAR(191) NOT NULL,
    `videoId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `status` ENUM('IDLE', 'TRANSCRIBING', 'TRANSCRIPT_DRAFT', 'TRANSCRIPT_CONFIRMED', 'DECOMPOSING', 'DECOMPOSED', 'REWRITING') NOT NULL DEFAULT 'IDLE',
    `enteredRewriteAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ai_workspaces_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `ai_workspaces_videoId_userId_key`(`videoId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_workspace_transcripts` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `originalText` LONGTEXT NULL,
    `currentText` LONGTEXT NULL,
    `isConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `confirmedAt` DATETIME(3) NULL,
    `lastEditedAt` DATETIME(3) NULL,
    `aiProviderKey` VARCHAR(191) NULL,
    `aiModel` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_workspace_transcripts_workspaceId_key`(`workspaceId`),
    INDEX `ai_workspace_transcripts_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_transcript_segments` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `text` TEXT NOT NULL,
    `summary` TEXT NULL,
    `purpose` TEXT NULL,
    `startOffset` INTEGER NOT NULL,
    `endOffset` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ai_transcript_segments_workspaceId_sortOrder_idx`(`workspaceId`, `sortOrder`),
    INDEX `ai_transcript_segments_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_decomposition_annotations` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `segmentId` VARCHAR(191) NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `startOffset` INTEGER NOT NULL,
    `endOffset` INTEGER NOT NULL,
    `quotedText` TEXT NOT NULL,
    `function` TEXT NULL,
    `argumentRole` TEXT NULL,
    `technique` TEXT NULL,
    `purpose` TEXT NULL,
    `effectiveness` TEXT NULL,
    `note` TEXT NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ai_decomposition_annotations_workspaceId_idx`(`workspaceId`),
    INDEX `ai_decomposition_annotations_organizationId_idx`(`organizationId`),
    INDEX `ai_decomposition_annotations_workspaceId_startOffset_endOffs_idx`(`workspaceId`, `startOffset`, `endOffset`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_rewrite_drafts` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `sourceTranscriptText` LONGTEXT NULL,
    `sourceDecompositionSnapshot` JSON NULL,
    `currentDraft` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_rewrite_drafts_workspaceId_key`(`workspaceId`),
    INDEX `ai_rewrite_drafts_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transcriptions` (
    `id` VARCHAR(191) NOT NULL,
    `videoId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `aiModel` VARCHAR(191) NOT NULL,
    `originalText` LONGTEXT NULL,
    `editedText` LONGTEXT NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `transcriptions_videoId_key`(`videoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `douyin_accounts` ADD CONSTRAINT `douyin_accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `douyin_accounts` ADD CONSTRAINT `douyin_accounts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `benchmark_accounts` ADD CONSTRAINT `benchmark_accounts_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `benchmark_accounts` ADD CONSTRAINT `benchmark_accounts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `benchmark_account_members` ADD CONSTRAINT `benchmark_account_members_benchmarkAccountId_fkey` FOREIGN KEY (`benchmarkAccountId`) REFERENCES `benchmark_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `benchmark_account_members` ADD CONSTRAINT `benchmark_account_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `benchmark_account_members` ADD CONSTRAINT `benchmark_account_members_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_collection_videos` ADD CONSTRAINT `employee_collection_videos_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `douyin_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `douyin_login_sessions` ADD CONSTRAINT `douyin_login_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `douyin_login_sessions` ADD CONSTRAINT `douyin_login_sessions_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `douyin_login_sessions` ADD CONSTRAINT `douyin_login_sessions_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `douyin_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `douyin_videos` ADD CONSTRAINT `douyin_videos_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `douyin_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `benchmark_videos` ADD CONSTRAINT `benchmark_videos_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `benchmark_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `benchmark_videos` ADD CONSTRAINT `benchmark_videos_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `video_snapshots` ADD CONSTRAINT `video_snapshots_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `douyin_videos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `benchmark_video_snapshots` ADD CONSTRAINT `benchmark_video_snapshots_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `benchmark_videos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_step_bindings` ADD CONSTRAINT `ai_step_bindings_modelConfigId_fkey` FOREIGN KEY (`modelConfigId`) REFERENCES `ai_model_configs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_workspaces` ADD CONSTRAINT `ai_workspaces_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `benchmark_videos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_workspaces` ADD CONSTRAINT `ai_workspaces_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_workspaces` ADD CONSTRAINT `ai_workspaces_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_workspace_transcripts` ADD CONSTRAINT `ai_workspace_transcripts_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `ai_workspaces`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_workspace_transcripts` ADD CONSTRAINT `ai_workspace_transcripts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_transcript_segments` ADD CONSTRAINT `ai_transcript_segments_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `ai_workspaces`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_transcript_segments` ADD CONSTRAINT `ai_transcript_segments_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_decomposition_annotations` ADD CONSTRAINT `ai_decomposition_annotations_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `ai_workspaces`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_decomposition_annotations` ADD CONSTRAINT `ai_decomposition_annotations_segmentId_fkey` FOREIGN KEY (`segmentId`) REFERENCES `ai_transcript_segments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_decomposition_annotations` ADD CONSTRAINT `ai_decomposition_annotations_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_decomposition_annotations` ADD CONSTRAINT `ai_decomposition_annotations_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_rewrite_drafts` ADD CONSTRAINT `ai_rewrite_drafts_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `ai_workspaces`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_rewrite_drafts` ADD CONSTRAINT `ai_rewrite_drafts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transcriptions` ADD CONSTRAINT `transcriptions_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `benchmark_videos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
