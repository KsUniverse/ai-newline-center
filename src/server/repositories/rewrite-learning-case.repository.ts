import { Prisma, type PrismaClient, type RewriteLearningCase, type RewriteLearningCaseStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export interface UpsertRewriteLearningCaseData {
  rewriteVersionId: string;
  rewriteId: string;
  publicationId: string;
  targetAccountId: string;
  organizationId: string;
  sourceBenchmarkVideoId?: string | null;
  sourceTranscriptSnapshot?: string | null;
  sourceAnnotationsSnapshot: Prisma.InputJsonValue;
  generatedContentSnapshot?: string | null;
  editedContentSnapshot?: string | null;
  finalContentSnapshot: string;
  usedFragmentSnapshot: Prisma.InputJsonValue;
  metricsSnapshot: Prisma.InputJsonValue;
  performanceScore: number;
  embeddingText?: string | null;
  embeddingJson?: Prisma.InputJsonValue | null;
  embeddingStatus: "PENDING" | "COMPLETED" | "FAILED";
  status?: RewriteLearningCaseStatus;
}

class RewriteLearningCaseRepository {
  async upsert(
    data: UpsertRewriteLearningCaseData,
    db: DatabaseClient = prisma,
  ): Promise<RewriteLearningCase> {
    return db.rewriteLearningCase.upsert({
      where: { rewriteVersionId: data.rewriteVersionId },
      create: {
        rewriteVersionId: data.rewriteVersionId,
        rewriteId: data.rewriteId,
        publicationId: data.publicationId,
        targetAccountId: data.targetAccountId,
        organizationId: data.organizationId,
        sourceBenchmarkVideoId: data.sourceBenchmarkVideoId ?? null,
        sourceTranscriptSnapshot: data.sourceTranscriptSnapshot ?? null,
        sourceAnnotationsSnapshot: data.sourceAnnotationsSnapshot,
        generatedContentSnapshot: data.generatedContentSnapshot ?? null,
        editedContentSnapshot: data.editedContentSnapshot ?? null,
        finalContentSnapshot: data.finalContentSnapshot,
        usedFragmentSnapshot: data.usedFragmentSnapshot,
        metricsSnapshot: data.metricsSnapshot,
        performanceScore: data.performanceScore,
        embeddingText: data.embeddingText ?? null,
        embeddingJson: data.embeddingJson ?? Prisma.JsonNull,
        embeddingStatus: data.embeddingStatus,
        status: data.status ?? "ACTIVE",
      },
      update: {
        publicationId: data.publicationId,
        targetAccountId: data.targetAccountId,
        organizationId: data.organizationId,
        sourceBenchmarkVideoId: data.sourceBenchmarkVideoId ?? null,
        sourceTranscriptSnapshot: data.sourceTranscriptSnapshot ?? null,
        sourceAnnotationsSnapshot: data.sourceAnnotationsSnapshot,
        generatedContentSnapshot: data.generatedContentSnapshot ?? null,
        editedContentSnapshot: data.editedContentSnapshot ?? null,
        finalContentSnapshot: data.finalContentSnapshot,
        usedFragmentSnapshot: data.usedFragmentSnapshot,
        metricsSnapshot: data.metricsSnapshot,
        performanceScore: data.performanceScore,
        embeddingText: data.embeddingText ?? null,
        embeddingJson: data.embeddingJson ?? Prisma.JsonNull,
        embeddingStatus: data.embeddingStatus,
        status: data.status ?? "ACTIVE",
      },
    });
  }

  async archiveByPublicationId(
    publicationId: string,
    db: DatabaseClient = prisma,
  ): Promise<void> {
    await db.rewriteLearningCase.updateMany({
      where: { publicationId },
      data: { status: "ARCHIVED" },
    });
  }

  async findByPublicationId(
    publicationId: string,
    db: DatabaseClient = prisma,
  ): Promise<RewriteLearningCase | null> {
    return db.rewriteLearningCase.findUnique({
      where: { publicationId },
    });
  }

  async findActiveByTargetAccountId(
    targetAccountId: string,
    organizationId: string,
    db: DatabaseClient = prisma,
  ): Promise<RewriteLearningCase[]> {
    return db.rewriteLearningCase.findMany({
      where: {
        targetAccountId,
        organizationId,
        status: "ACTIVE",
      },
      orderBy: [{ performanceScore: "desc" }, { updatedAt: "desc" }],
    });
  }
}

export const rewriteLearningCaseRepository = new RewriteLearningCaseRepository();
