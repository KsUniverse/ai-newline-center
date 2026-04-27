ALTER TABLE `rewrites` MODIFY `workspaceId` VARCHAR(191) NULL;
ALTER TABLE `rewrites` ADD COLUMN `mode` ENUM('WORKSPACE', 'DIRECT') NOT NULL DEFAULT 'WORKSPACE';
ALTER TABLE `rewrites` ADD COLUMN `topic` TEXT NULL;
CREATE INDEX `rewrites_mode_userId_idx` ON `rewrites`(`mode`, `userId`);
