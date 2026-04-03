-- AlterTable
ALTER TABLE "douyin_videos" ADD COLUMN     "admireCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "collectCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "coverSourceUrl" TEXT,
ADD COLUMN     "coverStoragePath" TEXT,
ADD COLUMN     "recommendCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "videoSourceUrl" TEXT,
ADD COLUMN     "videoStoragePath" TEXT;
