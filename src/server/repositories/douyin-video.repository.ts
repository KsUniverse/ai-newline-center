import type { DouyinVideo, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type FindManyWithAccountParams = {
  accountIds?: string[];
  tag?: string;
  sort: "publishedAt" | "likeCount";
  order: "asc" | "desc";
  page: number;
  limit: number;
};

export type DouyinVideoWithAccount = Prisma.DouyinVideoGetPayload<{
  include: {
    account: {
      select: {
        id: true;
        nickname: true;
        avatar: true;
      };
    };
  };
}>;

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
      tags?: string[];
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
        publishedAt: data.publishedAt,
        playCount: data.playCount,
        likeCount: data.likeCount,
        commentCount: data.commentCount,
        shareCount: data.shareCount,
        ...(data.tags ? { tags: data.tags } : {}),
      },
    });
  }

  async countByAccountId(accountId: string, db: DatabaseClient = prisma): Promise<number> {
    return db.douyinVideo.count({
      where: {
        accountId,
        deletedAt: null,
      },
    });
  }

  async findAllActive(db: DatabaseClient = prisma): Promise<DouyinVideo[]> {
    return db.douyinVideo.findMany({
      where: {
        deletedAt: null,
        account: {
          deletedAt: null,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async findManyWithAccount(
    params: FindManyWithAccountParams,
    db: DatabaseClient = prisma,
  ) {
    const { accountIds, tag, sort, order, page, limit } = params;
    const where: Prisma.DouyinVideoWhereInput = {
      deletedAt: null,
      ...(accountIds ? { accountId: { in: accountIds } } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
    };
    const orderBy: Prisma.DouyinVideoOrderByWithRelationInput[] = [
      { [sort]: order },
      { createdAt: "desc" },
    ];

    const [items, total] = await Promise.all([
      db.douyinVideo.findMany({
        where,
        include: {
          account: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.douyinVideo.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findByVideoId(videoId: string, db: DatabaseClient = prisma): Promise<DouyinVideo | null> {
    return db.douyinVideo.findFirst({
      where: {
        videoId,
        deletedAt: null,
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

  async updateStats(
    id: string,
    data: {
      playCount: number;
      likeCount: number;
      commentCount: number;
      shareCount: number;
    },
    db: DatabaseClient = prisma,
  ): Promise<DouyinVideo> {
    return db.douyinVideo.update({
      where: {
        id,
      },
      data,
    });
  }
}

export const douyinVideoRepository = new DouyinVideoRepository();
