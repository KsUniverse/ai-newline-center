-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "transcriptions" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "status" "TranscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "aiModel" TEXT NOT NULL,
    "originalText" TEXT,
    "editedText" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transcriptions_videoId_key" ON "transcriptions"("videoId");

-- AddForeignKey
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "douyin_videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
