-- Migrate legacy enum rows before removing the obsolete enum label.
UPDATE "ai_model_configs"
SET "videoInputMode" = 'DASHSCOPE_FILE'
WHERE "videoInputMode"::text = 'FRAMES_BASE64';

-- Rebuild the enum without FRAMES_BASE64.
ALTER TYPE "AiVideoInputMode" RENAME TO "AiVideoInputMode_old";

CREATE TYPE "AiVideoInputMode" AS ENUM ('NONE', 'DASHSCOPE_FILE', 'GOOGLE_FILE');

ALTER TABLE "ai_model_configs"
  ALTER COLUMN "videoInputMode" DROP DEFAULT,
  ALTER COLUMN "videoInputMode" TYPE "AiVideoInputMode"
  USING ("videoInputMode"::text::"AiVideoInputMode"),
  ALTER COLUMN "videoInputMode" SET DEFAULT 'NONE';

DROP TYPE "AiVideoInputMode_old";
