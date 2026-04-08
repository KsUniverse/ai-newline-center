-- AlterTable: rename enum value DASHSCOPE_FILE -> OSS_FILE in ai_model_configs
UPDATE `ai_model_configs` SET `videoInputMode` = 'OSS_FILE' WHERE `videoInputMode` = 'DASHSCOPE_FILE';

ALTER TABLE `ai_model_configs`
  MODIFY COLUMN `videoInputMode` ENUM('NONE', 'OSS_FILE', 'GOOGLE_FILE') NOT NULL DEFAULT 'NONE';
