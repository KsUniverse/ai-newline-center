-- CreateEnum
CREATE TYPE "AiStep" AS ENUM ('TRANSCRIBE', 'DECOMPOSE', 'REWRITE');

-- CreateEnum
CREATE TYPE "AiWorkspaceStatus" AS ENUM ('IDLE', 'TRANSCRIBING', 'TRANSCRIPT_DRAFT', 'TRANSCRIPT_CONFIRMED', 'DECOMPOSING', 'DECOMPOSED', 'REWRITING');

-- AlterTable
ALTER TABLE "benchmark_videos" ADD COLUMN     "shareUrl" TEXT;

-- AlterTable
ALTER TABLE "douyin_videos" ADD COLUMN     "shareUrl" TEXT;

-- CreateTable
CREATE TABLE "ai_step_bindings" (
    "id" TEXT NOT NULL,
    "step" "AiStep" NOT NULL,
    "implementationKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_step_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_workspaces" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "AiWorkspaceStatus" NOT NULL DEFAULT 'IDLE',
    "enteredRewriteAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_workspace_transcripts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "originalText" TEXT,
    "currentText" TEXT,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "lastEditedAt" TIMESTAMP(3),
    "aiProviderKey" TEXT,
    "aiModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_workspace_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_transcript_segments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "summary" TEXT,
    "purpose" TEXT,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_transcript_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_decomposition_annotations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "segmentId" TEXT,
    "organizationId" TEXT NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "quotedText" TEXT NOT NULL,
    "function" TEXT,
    "argumentRole" TEXT,
    "technique" TEXT,
    "purpose" TEXT,
    "effectiveness" TEXT,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_decomposition_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_decomposition_annotation_tags" (
    "id" TEXT NOT NULL,
    "annotationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_decomposition_annotation_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_rewrite_drafts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceTranscriptText" TEXT,
    "sourceDecompositionSnapshot" JSONB,
    "currentDraft" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_rewrite_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_step_bindings_step_key" ON "ai_step_bindings"("step");

-- CreateIndex
CREATE INDEX "ai_workspaces_organizationId_idx" ON "ai_workspaces"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_workspaces_videoId_userId_key" ON "ai_workspaces"("videoId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_workspace_transcripts_workspaceId_key" ON "ai_workspace_transcripts"("workspaceId");

-- CreateIndex
CREATE INDEX "ai_workspace_transcripts_organizationId_idx" ON "ai_workspace_transcripts"("organizationId");

-- CreateIndex
CREATE INDEX "ai_transcript_segments_workspaceId_sortOrder_idx" ON "ai_transcript_segments"("workspaceId", "sortOrder");

-- CreateIndex
CREATE INDEX "ai_transcript_segments_organizationId_idx" ON "ai_transcript_segments"("organizationId");

-- CreateIndex
CREATE INDEX "ai_decomposition_annotations_workspaceId_idx" ON "ai_decomposition_annotations"("workspaceId");

-- CreateIndex
CREATE INDEX "ai_decomposition_annotations_organizationId_idx" ON "ai_decomposition_annotations"("organizationId");

-- CreateIndex
CREATE INDEX "ai_decomposition_annotations_workspaceId_startOffset_endOff_idx" ON "ai_decomposition_annotations"("workspaceId", "startOffset", "endOffset");

-- CreateIndex
CREATE INDEX "ai_decomposition_annotation_tags_annotationId_idx" ON "ai_decomposition_annotation_tags"("annotationId");

-- CreateIndex
CREATE INDEX "ai_decomposition_annotation_tags_organizationId_idx" ON "ai_decomposition_annotation_tags"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_rewrite_drafts_workspaceId_key" ON "ai_rewrite_drafts"("workspaceId");

-- CreateIndex
CREATE INDEX "ai_rewrite_drafts_organizationId_idx" ON "ai_rewrite_drafts"("organizationId");

-- AddForeignKey
ALTER TABLE "ai_workspaces" ADD CONSTRAINT "ai_workspaces_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "benchmark_videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_workspaces" ADD CONSTRAINT "ai_workspaces_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_workspaces" ADD CONSTRAINT "ai_workspaces_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_workspace_transcripts" ADD CONSTRAINT "ai_workspace_transcripts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ai_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_workspace_transcripts" ADD CONSTRAINT "ai_workspace_transcripts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_transcript_segments" ADD CONSTRAINT "ai_transcript_segments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ai_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_transcript_segments" ADD CONSTRAINT "ai_transcript_segments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decomposition_annotations" ADD CONSTRAINT "ai_decomposition_annotations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ai_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decomposition_annotations" ADD CONSTRAINT "ai_decomposition_annotations_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "ai_transcript_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decomposition_annotations" ADD CONSTRAINT "ai_decomposition_annotations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decomposition_annotations" ADD CONSTRAINT "ai_decomposition_annotations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decomposition_annotation_tags" ADD CONSTRAINT "ai_decomposition_annotation_tags_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "ai_decomposition_annotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decomposition_annotation_tags" ADD CONSTRAINT "ai_decomposition_annotation_tags_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_rewrite_drafts" ADD CONSTRAINT "ai_rewrite_drafts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ai_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_rewrite_drafts" ADD CONSTRAINT "ai_rewrite_drafts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
