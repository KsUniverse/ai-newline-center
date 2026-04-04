-- CreateEnum
CREATE TYPE "DouyinAccountLoginStatus" AS ENUM ('NOT_LOGGED_IN', 'PENDING', 'LOGGED_IN', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "DouyinLoginSessionPurpose" AS ENUM ('CREATE_ACCOUNT', 'RELOGIN');

-- CreateEnum
CREATE TYPE "DouyinLoginSessionStatus" AS ENUM ('CREATED', 'QRCODE_READY', 'SCANNED', 'CONFIRMED', 'SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "douyin_accounts" ADD COLUMN     "loginErrorMessage" TEXT,
ADD COLUMN     "loginStateCheckedAt" TIMESTAMP(3),
ADD COLUMN     "loginStateExpiresAt" TIMESTAMP(3),
ADD COLUMN     "loginStatePath" TEXT,
ADD COLUMN     "loginStateUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "loginStatus" "DouyinAccountLoginStatus" NOT NULL DEFAULT 'NOT_LOGGED_IN';

-- CreateTable
CREATE TABLE "douyin_login_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT,
    "purpose" "DouyinLoginSessionPurpose" NOT NULL,
    "status" "DouyinLoginSessionStatus" NOT NULL DEFAULT 'CREATED',
    "qrcodeDataUrl" TEXT,
    "tempStatePath" TEXT,
    "resolvedSecUserId" TEXT,
    "expectedProfileUrl" TEXT,
    "resolvedProfileUrl" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "expiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "douyin_login_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "douyin_login_sessions_userId_idx" ON "douyin_login_sessions"("userId");

-- CreateIndex
CREATE INDEX "douyin_login_sessions_organizationId_idx" ON "douyin_login_sessions"("organizationId");

-- CreateIndex
CREATE INDEX "douyin_login_sessions_accountId_idx" ON "douyin_login_sessions"("accountId");

-- CreateIndex
CREATE INDEX "douyin_login_sessions_organizationId_status_idx" ON "douyin_login_sessions"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "douyin_login_sessions" ADD CONSTRAINT "douyin_login_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "douyin_login_sessions" ADD CONSTRAINT "douyin_login_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "douyin_login_sessions" ADD CONSTRAINT "douyin_login_sessions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "douyin_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
