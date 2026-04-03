-- AlterTable
ALTER TABLE "douyin_accounts" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "douyinNumber" TEXT,
ADD COLUMN     "followingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ipLocation" TEXT,
ADD COLUMN     "likesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "signature" TEXT,
ADD COLUMN     "verificationIconUrl" TEXT,
ADD COLUMN     "verificationLabel" TEXT,
ADD COLUMN     "verificationType" INTEGER;
