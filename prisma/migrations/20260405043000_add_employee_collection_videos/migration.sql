CREATE TABLE "employee_collection_videos" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "awemeId" TEXT NOT NULL,
    "authorSecUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_collection_videos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_collection_videos_accountId_awemeId_key"
ON "employee_collection_videos"("accountId", "awemeId");

CREATE INDEX "employee_collection_videos_accountId_createdAt_idx"
ON "employee_collection_videos"("accountId", "createdAt");

ALTER TABLE "employee_collection_videos"
ADD CONSTRAINT "employee_collection_videos_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "douyin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
