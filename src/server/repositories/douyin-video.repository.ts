import type { DouyinVideo, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

class DouyinVideoRepository {
  async upsertByVideoId(
    data: {
      videoId: string;
      accountId: string;
      title: string;
      coverUrl: string | null;
      videoUrl: string | null;
      publishedAt: Date | null;
      playCount: number;
      likeCount: number;
      commentCount: number;
      shareCount: number;
    },
    db: DatabaseClient = prisma,
  ): Promise<DouyinVideo> {
    return db.douyinVideo.upsert({
      where: {
        videoId: data.videoId,
      },
      create: data,
      update: {
        title: data.title,
        coverUrl: data.coverUrl,
        videoUrl: data.videoUrl,
        playCount: data.playCount,
        likeCount: data.likeCount,
        commentCount: data.commentCount,
        shareCount: data.shareCount,
      },
    });
  }

  async findByAccountId(
    params: { accountId: string; page: number; limit: number },
    db: DatabaseClient = prisma,
  ) {
    const { accountId, page, limit } = params;
    const where: Prisma.DouyinVideoWhereInput = {
      accountId,
      deletedAt: null,
    };

    const [items, total] = await Promise.all([
      db.douyinVideo.findMany({
        where,
        orderBy: [
          { publishedAt: "desc" },
          { createdAt: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.douyinVideo.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findById(id: string, db: DatabaseClient = prisma): Promise<DouyinVideo | null> {
    return db.douyinVideo.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }
}

export const douyinVideoRepository = new DouyinVideoRepository();
