-- CreateEnum
CREATE TYPE "DouyinAccountType" AS ENUM ('MY_ACCOUNT', 'BENCHMARK_ACCOUNT');

-- CreateTable
CREATE TABLE "douyin_accounts" (
    "id" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "bio" TEXT,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "videosCount" INTEGER NOT NULL DEFAULT 0,
    "type" "DouyinAccountType" NOT NULL DEFAULT 'MY_ACCOUNT',
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "douyin_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "douyin_videos" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT,
    "videoUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "douyin_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "douyin_accounts_profileUrl_key" ON "douyin_accounts"("profileUrl");

-- CreateIndex
CREATE INDEX "douyin_accounts_userId_idx" ON "douyin_accounts"("userId");

-- CreateIndex
CREATE INDEX "douyin_accounts_organizationId_idx" ON "douyin_accounts"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "douyin_videos_videoId_key" ON "douyin_videos"("videoId");

-- CreateIndex
CREATE INDEX "douyin_videos_accountId_idx" ON "douyin_videos"("accountId");

-- AddForeignKey
ALTER TABLE "douyin_accounts" ADD CONSTRAINT "douyin_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "douyin_accounts" ADD CONSTRAINT "douyin_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "douyin_videos" ADD CONSTRAINT "douyin_videos_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "douyin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
