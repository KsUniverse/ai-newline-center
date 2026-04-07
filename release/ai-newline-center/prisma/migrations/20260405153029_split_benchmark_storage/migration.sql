/*
  Warnings:

  - You are about to drop the column `type` on the `douyin_accounts` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "BenchmarkAccountMemberSource" AS ENUM ('MANUAL', 'COLLECTION_SYNC');

-- DropForeignKey
ALTER TABLE "transcriptions" DROP CONSTRAINT "transcriptions_videoId_fkey";

-- AlterTable
ALTER TABLE "douyin_accounts" ADD COLUMN     "favoriteCookieHeader" TEXT;

-- CreateTable
CREATE TABLE "benchmark_accounts" (
    "id" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "secUserId" TEXT,
    "nickname" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "bio" TEXT,
    "signature" TEXT,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "videosCount" INTEGER NOT NULL DEFAULT 0,
    "douyinNumber" TEXT,
    "ipLocation" TEXT,
    "age" INTEGER,
    "province" TEXT,
    "city" TEXT,
    "verificationLabel" TEXT,
    "verificationIconUrl" TEXT,
    "verificationType" INTEGER,
    "createdByUserId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "benchmark_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_account_members" (
    "id" TEXT NOT NULL,
    "benchmarkAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" "BenchmarkAccountMemberSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benchmark_account_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_videos" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT,
    "coverSourceUrl" TEXT,
    "coverStoragePath" TEXT,
    "videoUrl" TEXT,
    "videoSourceUrl" TEXT,
    "videoStoragePath" TEXT,
    "publishedAt" TIMESTAMP(3),
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "collectCount" INTEGER NOT NULL DEFAULT 0,
    "admireCount" INTEGER NOT NULL DEFAULT 0,
    "recommendCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "benchmark_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_video_snapshots" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playsCount" INTEGER NOT NULL,
    "likesCount" INTEGER NOT NULL,
    "commentsCount" INTEGER NOT NULL,
    "sharesCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benchmark_video_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "benchmark_accounts_createdByUserId_idx" ON "benchmark_accounts"("createdByUserId");

-- CreateIndex
CREATE INDEX "benchmark_accounts_organizationId_idx" ON "benchmark_accounts"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_accounts_organizationId_profileUrl_key" ON "benchmark_accounts"("organizationId", "profileUrl");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_accounts_organizationId_secUserId_key" ON "benchmark_accounts"("organizationId", "secUserId");

-- CreateIndex
CREATE INDEX "benchmark_account_members_organizationId_idx" ON "benchmark_account_members"("organizationId");

-- CreateIndex
CREATE INDEX "benchmark_account_members_userId_idx" ON "benchmark_account_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_account_members_benchmarkAccountId_userId_key" ON "benchmark_account_members"("benchmarkAccountId", "userId");

-- CreateIndex
CREATE INDEX "benchmark_videos_accountId_idx" ON "benchmark_videos"("accountId");

-- CreateIndex
CREATE INDEX "benchmark_videos_organizationId_idx" ON "benchmark_videos"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_videos_accountId_videoId_key" ON "benchmark_videos"("accountId", "videoId");

-- CreateIndex
CREATE INDEX "benchmark_video_snapshots_videoId_idx" ON "benchmark_video_snapshots"("videoId");

-- CreateIndex
CREATE INDEX "benchmark_video_snapshots_videoId_timestamp_idx" ON "benchmark_video_snapshots"("videoId", "timestamp");

-- Migrate benchmark accounts out of douyin_accounts while preserving ids.
INSERT INTO "benchmark_accounts" (
    "id",
    "profileUrl",
    "secUserId",
    "nickname",
    "avatar",
    "bio",
    "signature",
    "followersCount",
    "followingCount",
    "likesCount",
    "videosCount",
    "douyinNumber",
    "ipLocation",
    "age",
    "province",
    "city",
    "verificationLabel",
    "verificationIconUrl",
    "verificationType",
    "createdByUserId",
    "organizationId",
    "lastSyncedAt",
    "createdAt",
    "updatedAt",
    "deletedAt"
)
SELECT
    "id",
    "profileUrl",
    "secUserId",
    "nickname",
    "avatar",
    "bio",
    "signature",
    "followersCount",
    "followingCount",
    "likesCount",
    "videosCount",
    "douyinNumber",
    "ipLocation",
    "age",
    "province",
    "city",
    "verificationLabel",
    "verificationIconUrl",
    "verificationType",
    "userId",
    "organizationId",
    "lastSyncedAt",
    "createdAt",
    "updatedAt",
    "deletedAt"
FROM "douyin_accounts"
WHERE "type" = 'BENCHMARK_ACCOUNT';

INSERT INTO "benchmark_account_members" (
    "id",
    "benchmarkAccountId",
    "userId",
    "organizationId",
    "source",
    "createdAt",
    "updatedAt"
)
SELECT
    'migrated_member_' || "id",
    "id",
    "userId",
    "organizationId",
    'MANUAL'::"BenchmarkAccountMemberSource",
    "createdAt",
    "updatedAt"
FROM "douyin_accounts"
WHERE "type" = 'BENCHMARK_ACCOUNT';

INSERT INTO "benchmark_videos" (
    "id",
    "videoId",
    "accountId",
    "organizationId",
    "title",
    "coverUrl",
    "coverSourceUrl",
    "coverStoragePath",
    "videoUrl",
    "videoSourceUrl",
    "videoStoragePath",
    "publishedAt",
    "playCount",
    "likeCount",
    "commentCount",
    "shareCount",
    "collectCount",
    "admireCount",
    "recommendCount",
    "tags",
    "createdAt",
    "updatedAt",
    "deletedAt"
)
SELECT
    dv."id",
    dv."videoId",
    dv."accountId",
    da."organizationId",
    dv."title",
    dv."coverUrl",
    dv."coverSourceUrl",
    dv."coverStoragePath",
    dv."videoUrl",
    dv."videoSourceUrl",
    dv."videoStoragePath",
    dv."publishedAt",
    dv."playCount",
    dv."likeCount",
    dv."commentCount",
    dv."shareCount",
    dv."collectCount",
    dv."admireCount",
    dv."recommendCount",
    dv."tags",
    dv."createdAt",
    dv."updatedAt",
    dv."deletedAt"
FROM "douyin_videos" dv
INNER JOIN "douyin_accounts" da ON da."id" = dv."accountId"
WHERE da."type" = 'BENCHMARK_ACCOUNT';

INSERT INTO "benchmark_video_snapshots" (
    "id",
    "videoId",
    "timestamp",
    "playsCount",
    "likesCount",
    "commentsCount",
    "sharesCount",
    "createdAt",
    "updatedAt"
)
SELECT
    vs."id",
    vs."videoId",
    vs."timestamp",
    vs."playsCount",
    vs."likesCount",
    vs."commentsCount",
    vs."sharesCount",
    vs."createdAt",
    vs."updatedAt"
FROM "video_snapshots" vs
INNER JOIN "douyin_videos" dv ON dv."id" = vs."videoId"
INNER JOIN "douyin_accounts" da ON da."id" = dv."accountId"
WHERE da."type" = 'BENCHMARK_ACCOUNT';

-- Transcriptions are now benchmark-video only. Remove any historical rows that do not point to a migrated benchmark video.
DELETE FROM "transcriptions" t
WHERE NOT EXISTS (
    SELECT 1
    FROM "benchmark_videos" bv
    WHERE bv."id" = t."videoId"
);

-- Remove migrated benchmark rows from the old shared tables.
DELETE FROM "video_snapshots" vs
USING "douyin_videos" dv, "douyin_accounts" da
WHERE dv."id" = vs."videoId"
  AND da."id" = dv."accountId"
  AND da."type" = 'BENCHMARK_ACCOUNT';

DELETE FROM "douyin_videos" dv
USING "douyin_accounts" da
WHERE da."id" = dv."accountId"
  AND da."type" = 'BENCHMARK_ACCOUNT';

DELETE FROM "douyin_accounts"
WHERE "type" = 'BENCHMARK_ACCOUNT';

-- AlterTable
ALTER TABLE "douyin_accounts" DROP COLUMN "type";

-- DropEnum
DROP TYPE "DouyinAccountType";

-- AddForeignKey
ALTER TABLE "benchmark_accounts" ADD CONSTRAINT "benchmark_accounts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_accounts" ADD CONSTRAINT "benchmark_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_account_members" ADD CONSTRAINT "benchmark_account_members_benchmarkAccountId_fkey" FOREIGN KEY ("benchmarkAccountId") REFERENCES "benchmark_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_account_members" ADD CONSTRAINT "benchmark_account_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_account_members" ADD CONSTRAINT "benchmark_account_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_videos" ADD CONSTRAINT "benchmark_videos_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "benchmark_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_videos" ADD CONSTRAINT "benchmark_videos_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_video_snapshots" ADD CONSTRAINT "benchmark_video_snapshots_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "benchmark_videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "benchmark_videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
