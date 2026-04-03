-- AlterTable
ALTER TABLE "douyin_accounts" ADD COLUMN "secUserId" TEXT;

-- AlterTable
ALTER TABLE "douyin_videos" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "video_snapshots" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playsCount" INTEGER NOT NULL,
    "likesCount" INTEGER NOT NULL,
    "commentsCount" INTEGER NOT NULL,
    "sharesCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "douyin_accounts_secUserId_key" ON "douyin_accounts"("secUserId");

-- CreateIndex
CREATE INDEX "video_snapshots_videoId_idx" ON "video_snapshots"("videoId");

-- CreateIndex
CREATE INDEX "video_snapshots_videoId_timestamp_idx" ON "video_snapshots"("videoId", "timestamp");

-- AddForeignKey
ALTER TABLE "video_snapshots" ADD CONSTRAINT "video_snapshots_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "douyin_videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
