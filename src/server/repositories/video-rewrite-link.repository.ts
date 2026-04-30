import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type VideoRewriteLinkWithRewrite = Prisma.VideoRewriteLinkGetPayload<{
  include: {
    rewrite: {
      select: {
        id: true;
        mode: true;
        topic: true;
        targetAccount: { select: { nickname: true } };
        versions: {
          where: { isFinalVersion: true };
          orderBy: { versionNumber: "desc" };
          take: 1;
          select: { editedContent: true; generatedContent: true };
        };
      };
    };
  };
}>;

class VideoRewriteLinkRepository {
  async create(
    data: { videoId: string; rewriteId: string },
    db: DatabaseClient = prisma,
  ): Promise<VideoRewriteLinkWithRewrite> {
    await db.videoRewriteLink.create({ data });
    const result = await this.findByVideoId(data.videoId, db);
    return result!;
  }

  async findByVideoId(
    videoId: string,
    db: DatabaseClient = prisma,
  ): Promise<VideoRewriteLinkWithRewrite | null> {
    return db.videoRewriteLink.findUnique({
      where: { videoId },
      include: {
        rewrite: {
          select: {
            id: true,
            mode: true,
            topic: true,
            targetAccount: { select: { nickname: true } },
            versions: {
              where: { isFinalVersion: true },
              orderBy: { versionNumber: "desc" },
              take: 1,
              select: { editedContent: true, generatedContent: true },
            },
          },
        },
      },
    });
  }

  async deleteByVideoId(videoId: string, db: DatabaseClient = prisma): Promise<void> {
    await db.videoRewriteLink.deleteMany({ where: { videoId } });
  }
}

export const videoRewriteLinkRepository = new VideoRewriteLinkRepository();
