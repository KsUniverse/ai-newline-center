import type {
  AiDecompositionAnnotation,
  AiRewriteDraft,
  AiWorkspace,
  AiWorkspaceStatus,
  PrismaClient,
} from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type AiWorkspaceWithDetails = Prisma.AiWorkspaceGetPayload<{
  include: {
    video: true;
    transcript: true;
    segments: {
      orderBy: {
        sortOrder: "asc";
      };
    };
    annotations: {
      orderBy: {
        createdAt: "asc";
      };
    };
    rewriteDraft: true;
  };
}>;

export interface CreateAiWorkspaceData {
  videoId: string;
  userId: string;
  organizationId: string;
  status?: AiWorkspaceStatus;
}

export interface UpsertTranscriptData {
  originalText?: string | null;
  currentText?: string | null;
  isConfirmed?: boolean;
  confirmedAt?: Date | null;
  lastEditedAt?: Date | null;
  aiProviderKey?: string | null;
  aiModel?: string | null;
}

export interface SaveSegmentData {
  sortOrder: number;
  text: string;
  summary?: string | null;
  purpose?: string | null;
  startOffset: number;
  endOffset: number;
}

export interface UpsertAnnotationData {
  segmentId?: string | null;
  startOffset: number;
  endOffset: number;
  quotedText: string;
  function?: string | null;
  argumentRole?: string | null;
  technique?: string | null;
  purpose?: string | null;
  effectiveness?: string | null;
  note?: string | null;
  createdByUserId: string;
}

export interface UpsertRewriteDraftData {
  currentDraft: string | null;
  sourceTranscriptText: string | null;
  sourceDecompositionSnapshot?: Prisma.InputJsonValue;
}

class AiWorkspaceRepository {
  private async runTransaction<T>(
    db: DatabaseClient,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if ("$transaction" in db) {
      return db.$transaction(action);
    }

    return action(db);
  }

  async findByVideoIdAndUserId(
    videoId: string,
    userId: string,
    db: DatabaseClient = prisma,
  ): Promise<AiWorkspace | null> {
    return db.aiWorkspace.findUnique({
      where: {
        videoId_userId: {
          videoId,
          userId,
        },
      },
    });
  }

  async findById(
    id: string,
    db: DatabaseClient = prisma,
  ): Promise<AiWorkspaceWithDetails | null> {
    return db.aiWorkspace.findUnique({
      where: { id },
      include: {
        video: true,
        transcript: true,
        segments: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        annotations: {
          orderBy: {
            createdAt: "asc",
          },
        },
        rewriteDraft: true,
      },
    });
  }

  async create(
    data: CreateAiWorkspaceData,
    db: DatabaseClient = prisma,
  ): Promise<AiWorkspace> {
    return db.aiWorkspace.create({
      data,
    });
  }

  async update(
    id: string,
    data: { status?: AiWorkspaceStatus; enteredRewriteAt?: Date | null },
    db: DatabaseClient = prisma,
  ): Promise<AiWorkspace> {
    return db.aiWorkspace.update({
      where: { id },
      data,
    });
  }

  async upsertTranscript(
    workspaceId: string,
    organizationId: string,
    data: UpsertTranscriptData,
    db: DatabaseClient = prisma,
  ): Promise<AiWorkspace> {
    await db.aiWorkspaceTranscript.upsert({
      where: {
        workspaceId,
      },
      create: {
        workspaceId,
        organizationId,
        ...data,
      },
      update: {
        ...data,
      },
    });

    return db.aiWorkspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
  }

  async replaceSegments(
    workspaceId: string,
    organizationId: string,
    segments: SaveSegmentData[],
    db: DatabaseClient = prisma,
  ): Promise<void> {
    await this.runTransaction(db, async (tx: Prisma.TransactionClient) => {
      await tx.aiTranscriptSegment.deleteMany({
        where: {
          workspaceId,
        },
      });

      if (segments.length === 0) {
        return;
      }

      await tx.aiTranscriptSegment.createMany({
        data: segments.map((segment) => ({
          workspaceId,
          organizationId,
          ...segment,
        })),
      });
    });
  }

  async upsertAnnotation(
    workspaceId: string,
    organizationId: string,
    data: UpsertAnnotationData,
    db: DatabaseClient = prisma,
  ): Promise<AiDecompositionAnnotation> {
    const annotation = await db.aiDecompositionAnnotation.create({
      data: {
        workspaceId,
        organizationId,
        segmentId: data.segmentId ?? null,
        startOffset: data.startOffset,
        endOffset: data.endOffset,
        quotedText: data.quotedText,
        function: data.function ?? null,
        argumentRole: data.argumentRole ?? null,
        technique: data.technique ?? null,
        purpose: data.purpose ?? null,
        effectiveness: data.effectiveness ?? null,
        note: data.note ?? null,
        createdByUserId: data.createdByUserId,
      },
    });

    return annotation;
  }

  async updateAnnotation(
    annotationId: string,
    data: Omit<UpsertAnnotationData, "createdByUserId">,
    db: DatabaseClient = prisma,
  ): Promise<AiDecompositionAnnotation> {
    const annotation = await db.aiDecompositionAnnotation.update({
      where: { id: annotationId },
      data: {
        segmentId: data.segmentId ?? null,
        startOffset: data.startOffset,
        endOffset: data.endOffset,
        quotedText: data.quotedText,
        function: data.function ?? null,
        argumentRole: data.argumentRole ?? null,
        technique: data.technique ?? null,
        purpose: data.purpose ?? null,
        effectiveness: data.effectiveness ?? null,
        note: data.note ?? null,
      },
    });

    return annotation;
  }

  async deleteAnnotation(annotationId: string, db: DatabaseClient = prisma): Promise<void> {
    await db.aiDecompositionAnnotation.delete({
      where: { id: annotationId },
    });
  }

  async clearDependencies(workspaceId: string, db: DatabaseClient = prisma): Promise<void> {
    await this.runTransaction(db, async (tx: Prisma.TransactionClient) => {
      const annotations = await tx.aiDecompositionAnnotation.findMany({
        where: {
          workspaceId,
        },
        select: {
          id: true,
        },
      });

      if (annotations.length > 0) {
        await tx.aiDecompositionAnnotation.deleteMany({
          where: {
            workspaceId,
          },
        });
      }

      await tx.aiRewriteDraft.deleteMany({
        where: {
          workspaceId,
        },
      });
    });
  }

  async upsertRewriteDraft(
    workspaceId: string,
    organizationId: string,
    data: UpsertRewriteDraftData,
    db: DatabaseClient = prisma,
  ): Promise<AiRewriteDraft> {
    return db.aiRewriteDraft.upsert({
      where: {
        workspaceId,
      },
      create: {
        workspaceId,
        organizationId,
        ...data,
        sourceDecompositionSnapshot:
          data.sourceDecompositionSnapshot ?? Prisma.JsonNull,
      },
      update: {
        ...data,
        sourceDecompositionSnapshot:
          data.sourceDecompositionSnapshot ?? Prisma.JsonNull,
      },
    });
  }

  async deleteRewriteDraft(workspaceId: string, db: DatabaseClient = prisma): Promise<void> {
    await db.aiRewriteDraft.deleteMany({
      where: {
        workspaceId,
      },
    });
  }
}

export const aiWorkspaceRepository = new AiWorkspaceRepository();

