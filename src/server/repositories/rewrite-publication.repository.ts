import type { Prisma, PrismaClient, RewritePublicationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const activePublicationInclude = {
  publishedVideo: {
    select: {
      id: true,
      title: true,
      coverUrl: true,
      publishedAt: true,
      playCount: true,
      likeCount: true,
      commentCount: true,
      shareCount: true,
      collectCount: true,
      admireCount: true,
      recommendCount: true,
    },
  },
  rewriteVersion: {
    select: {
      id: true,
      versionNumber: true,
      generatedContent: true,
      editedContent: true,
      isFinalVersion: true,
      rewrite: {
        select: {
          id: true,
          mode: true,
          topic: true,
          targetAccount: {
            select: {
              id: true,
              nickname: true,
            },
          },
        },
      },
    },
  },
  learningCase: {
    select: {
      id: true,
      performanceScore: true,
      metricsSnapshot: true,
      status: true,
    },
  },
} satisfies Prisma.RewritePublicationInclude;

export type ActiveRewritePublication = Prisma.RewritePublicationGetPayload<{
  include: typeof activePublicationInclude;
}>;

class RewritePublicationRepository {
  async findActiveByVersionId(
    rewriteVersionId: string,
    db: DatabaseClient = prisma,
  ): Promise<Prisma.RewritePublicationGetPayload<{ include: typeof activePublicationInclude }> | null> {
    return db.rewritePublication.findFirst({
      where: {
        rewriteVersionId,
        status: "LINKED",
      },
      include: activePublicationInclude,
    });
  }

  async findActiveByPublishedVideoId(
    publishedVideoId: string,
    db: DatabaseClient = prisma,
  ): Promise<Prisma.RewritePublicationGetPayload<{ include: typeof activePublicationInclude }> | null> {
    return db.rewritePublication.findFirst({
      where: {
        publishedVideoId,
        status: "LINKED",
      },
      include: activePublicationInclude,
    });
  }

  async create(
    data: {
      rewriteVersionId: string;
      rewriteId: string;
      targetAccountId: string;
      publishedVideoId: string;
      organizationId: string;
      status?: RewritePublicationStatus;
    },
    db: DatabaseClient = prisma,
  ): Promise<ActiveRewritePublication> {
    const created = await db.rewritePublication.create({
      data: {
        rewriteVersionId: data.rewriteVersionId,
        rewriteId: data.rewriteId,
        targetAccountId: data.targetAccountId,
        publishedVideoId: data.publishedVideoId,
        organizationId: data.organizationId,
        status: data.status ?? "LINKED",
      },
    });

    return (await this.findById(created.id, db))!;
  }

  async unlinkActiveByVersionId(
    rewriteVersionId: string,
    db: DatabaseClient = prisma,
  ): Promise<void> {
    await db.rewritePublication.updateMany({
      where: {
        rewriteVersionId,
        status: "LINKED",
      },
      data: {
        status: "UNLINKED",
      },
    });
  }

  async findById(
    id: string,
    db: DatabaseClient = prisma,
  ): Promise<ActiveRewritePublication | null> {
    return db.rewritePublication.findUnique({
      where: { id },
      include: activePublicationInclude,
    });
  }
}

export const rewritePublicationRepository = new RewritePublicationRepository();
