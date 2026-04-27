import type {
  AiDecompositionAnnotation,
  AiRewriteDraft,
  AiWorkspace,
  AiWorkspaceStatus,
  PrismaClient,
} from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { CursorPaginatedData } from "@/types/api";
import type { DecompositionListItemDTO } from "@/types/ai-workspace";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

// ─── Cursor 工具（仅此文件内部使用）────────────────────────────────────────────

interface WorkspaceCursor {
  updatedAt: string; // ISO 8601
  id: string;
}

function encodeCursor(cursor: WorkspaceCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(encoded: string): WorkspaceCursor {
  const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)["updatedAt"] !== "string" ||
    typeof (parsed as Record<string, unknown>)["id"] !== "string"
  ) {
    throw new Error("Invalid cursor format");
  }
  return parsed as WorkspaceCursor;
}

// ─── Include 片段（可复用，satisfies 约束）──────────────────────────────────────

const decompositionListInclude = {
  video: {
    select: {
      id: true,
      title: true,
      coverUrl: true,
      account: {
        select: { id: true, nickname: true, avatar: true },
      },
    },
  },
  _count: {
    select: { annotations: true },
  },
} satisfies Prisma.AiWorkspaceInclude;

type DecompositionListRawItem = Prisma.AiWorkspaceGetPayload<{
  include: typeof decompositionListInclude;
}>;

function mapToDecompositionListItemDTO(item: DecompositionListRawItem): DecompositionListItemDTO {
  return {
    workspaceId: item.id,
    videoId: item.video.id,
    videoTitle: item.video.title,
    videoCoverUrl: item.video.coverUrl ?? null,
    accountId: item.video.account.id,
    accountNickname: item.video.account.nickname,
    accountAvatar: item.video.account.avatar,
    annotationCount: item._count.annotations,
    updatedAt: item.updatedAt.toISOString(),
  };
}

export interface ListDecompositionsRepoParams {
  userId: string;
  organizationId: string;
  cursor?: string;
  limit?: number;
  benchmarkAccountIds?: string[];
  hasAnnotations?: boolean;
}

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

export interface ResetTranscriptToDraftData {
  lastEditedAt: Date;
}

export interface CompleteWorkspaceTranscriptionData {
  originalText: string;
  currentText: string;
  aiProviderKey?: string | null;
  aiModel?: string | null;
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

  async updateAnnotationInWorkspace(
    workspaceId: string,
    annotationId: string,
    data: Omit<UpsertAnnotationData, "createdByUserId">,
    db: DatabaseClient = prisma,
  ): Promise<boolean> {
    const result = await db.aiDecompositionAnnotation.updateMany({
      where: {
        id: annotationId,
        workspaceId,
      },
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

    return result.count > 0;
  }

  async deleteAnnotationInWorkspace(
    workspaceId: string,
    annotationId: string,
    db: DatabaseClient = prisma,
  ): Promise<boolean> {
    const result = await db.aiDecompositionAnnotation.deleteMany({
      where: {
        id: annotationId,
        workspaceId,
      },
    });

    return result.count > 0;
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

  async resetTranscriptToDraft(
    workspaceId: string,
    organizationId: string,
    data: ResetTranscriptToDraftData,
    db: DatabaseClient = prisma,
  ): Promise<void> {
    await this.runTransaction(db, async (tx: Prisma.TransactionClient) => {
      await tx.aiTranscriptSegment.deleteMany({
        where: {
          workspaceId,
        },
      });

      await tx.aiDecompositionAnnotation.deleteMany({
        where: {
          workspaceId,
        },
      });

      await tx.aiRewriteDraft.deleteMany({
        where: {
          workspaceId,
        },
      });

      await tx.aiWorkspaceTranscript.upsert({
        where: {
          workspaceId,
        },
        create: {
          workspaceId,
          organizationId,
          isConfirmed: false,
          confirmedAt: null,
          lastEditedAt: data.lastEditedAt,
        },
        update: {
          isConfirmed: false,
          confirmedAt: null,
          lastEditedAt: data.lastEditedAt,
        },
      });

      await tx.aiWorkspace.update({
        where: { id: workspaceId },
        data: {
          status: "TRANSCRIPT_DRAFT",
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

  async completeQueuedTranscription(
    workspaceId: string,
    organizationId: string,
    data: CompleteWorkspaceTranscriptionData,
    db: DatabaseClient = prisma,
  ): Promise<void> {
    await this.runTransaction(db, async (tx: Prisma.TransactionClient) => {
      await tx.aiTranscriptSegment.deleteMany({
        where: {
          workspaceId,
        },
      });

      await tx.aiDecompositionAnnotation.deleteMany({
        where: {
          workspaceId,
        },
      });

      await tx.aiRewriteDraft.deleteMany({
        where: {
          workspaceId,
        },
      });

      await tx.aiWorkspaceTranscript.upsert({
        where: {
          workspaceId,
        },
        create: {
          workspaceId,
          organizationId,
          originalText: data.originalText,
          currentText: data.currentText,
          isConfirmed: false,
          confirmedAt: null,
          lastEditedAt: new Date(),
          aiProviderKey: data.aiProviderKey ?? null,
          aiModel: data.aiModel ?? null,
        },
        update: {
          originalText: data.originalText,
          currentText: data.currentText,
          isConfirmed: false,
          confirmedAt: null,
          lastEditedAt: new Date(),
          aiProviderKey: data.aiProviderKey ?? null,
          aiModel: data.aiModel ?? null,
        },
      });

      await tx.aiWorkspace.update({
        where: { id: workspaceId },
        data: {
          status: "TRANSCRIPT_DRAFT",
        },
      });
    });
  }

  async markQueuedTranscriptionFailed(
    workspaceId: string,
    db: DatabaseClient = prisma,
  ): Promise<void> {
    await db.aiWorkspace.update({
      where: { id: workspaceId },
      data: {
        status: "IDLE",
      },
    });
  }

  async listDecompositions(
    params: ListDecompositionsRepoParams,
  ): Promise<CursorPaginatedData<DecompositionListItemDTO>> {
    const {
      userId,
      organizationId,
      cursor,
      limit = 20,
      benchmarkAccountIds,
      hasAnnotations,
    } = params;

    let cursorObj: WorkspaceCursor | null = null;
    if (cursor) {
      try {
        cursorObj = decodeCursor(cursor);
      } catch {
        cursorObj = null;
      }
    }

    const where: Prisma.AiWorkspaceWhereInput = {
      userId,
      organizationId,
      ...(benchmarkAccountIds != null && benchmarkAccountIds.length > 0
        ? { video: { accountId: { in: benchmarkAccountIds } } }
        : {}),
      ...(hasAnnotations === true ? { annotations: { some: {} } } : {}),
      ...(hasAnnotations === false ? { annotations: { none: {} } } : {}),
      ...(cursorObj != null
        ? {
            OR: [
              { updatedAt: { lt: new Date(cursorObj.updatedAt) } },
              {
                AND: [
                  { updatedAt: { equals: new Date(cursorObj.updatedAt) } },
                  { id: { gt: cursorObj.id } },
                ],
              },
            ],
          }
        : {}),
    };

    const rows = await prisma.aiWorkspace.findMany({
      where,
      include: decompositionListInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem != null
        ? encodeCursor({ updatedAt: lastItem.updatedAt.toISOString(), id: lastItem.id })
        : null;

    return {
      items: items.map(mapToDecompositionListItemDTO),
      nextCursor,
      hasMore,
    };
  }

  async findDistinctBenchmarkAccountsByUser(params: {
    userId: string;
    organizationId: string;
  }): Promise<Array<{ id: string; nickname: string; avatar: string }>> {
    return prisma.benchmarkAccount.findMany({
      where: {
        deletedAt: null,
        videos: {
          some: {
            aiWorkspaces: {
              some: {
                userId: params.userId,
                organizationId: params.organizationId,
              },
            },
          },
        },
      },
      select: { id: true, nickname: true, avatar: true },
      orderBy: { nickname: "asc" },
    });
  }
}

export const aiWorkspaceRepository = new AiWorkspaceRepository();

