import type { BenchmarkVideo, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type BenchmarkVideoWithAccountOrganization = Prisma.BenchmarkVideoGetPayload<{
  include: {
    account: {
      include: {
        organization: true;
      };
    };
  };
}>;

export type BenchmarkVideoWithLatestSnapshot = Prisma.BenchmarkVideoGetPayload<{
  include: {
    snapshots: {
      orderBy: {
        timestamp: "desc";
      };
      take: 1;
    };
  };
}>;

class BenchmarkVideoRepository {
  async upsertByVideoId(
    data: {
      videoId: string;
      accountId: string;
      organizationId: string;
      title: string;
      coverUrl: string | null;
      coverSourceUrl?: string | null;
      coverStoragePath?: string | null;
      videoUrl: string | null;
      videoSourceUrl?: string | null;
      videoStoragePath?: string | null;
      publishedAt: Date | null;
      playCount: number;
      likeCount: number;
      commentCount: number;
      shareCount: number;
      collectCount?: number;
      admireCount?: number;
      recommendCount?: number;
      tags?: string[];
    },
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkVideo> {
    return db.benchmarkVideo.upsert({
      where: {
        accountId_videoId: {
          accountId: data.accountId,
          videoId: data.videoId,
        },
      },
      create: data,
      update: {
        title: data.title,
        coverUrl: data.coverUrl,
        coverSourceUrl: data.coverSourceUrl,
        coverStoragePath: data.coverStoragePath,
        videoUrl: data.videoUrl,
        videoSourceUrl: data.videoSourceUrl,
        videoStoragePath: data.videoStoragePath,
        publishedAt: data.publishedAt,
        playCount: data.playCount,
        likeCount: data.likeCount,
        commentCount: data.commentCount,
        shareCount: data.shareCount,
        collectCount: data.collectCount,
        admireCount: data.admireCount,
        recommendCount: data.recommendCount,
        ...(data.tags ? { tags: data.tags } : {}),
      },
    });
  }

  async updateStatsByAccountVideoId(
    accountId: string,
    videoId: string,
    stats: {
      playCount: number;
      likeCount: number;
      commentCount: number;
      shareCount: number;
      collectCount?: number;
      admireCount?: number;
      recommendCount?: number;
    },
    db: DatabaseClient = prisma,
  ): Promise<void> {
    await db.benchmarkVideo.update({
      where: {
        accountId_videoId: {
          accountId,
          videoId,
        },
      },
      data: stats,
    });
  }

  async countByAccountId(accountId: string, db: DatabaseClient = prisma): Promise<number> {
    return db.benchmarkVideo.count({
      where: {
        accountId,
        deletedAt: null,
      },
    });
  }

  async findAllActiveForSnapshotSync(
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkVideoWithLatestSnapshot[]> {
    return db.benchmarkVideo.findMany({
      where: {
        deletedAt: null,
        account: {
          deletedAt: null,
        },
      },
      include: {
        snapshots: {
          orderBy: {
            timestamp: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async findByAccountAndVideoId(
    accountId: string,
    videoId: string,
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkVideo | null> {
    return db.benchmarkVideo.findFirst({
      where: {
        accountId,
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
    const where: Prisma.BenchmarkVideoWhereInput = {
      accountId,
      deletedAt: null,
    };

    const [items, total] = await Promise.all([
      db.benchmarkVideo.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.benchmarkVideo.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findByIdWithAccountOrganization(
    id: string,
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkVideoWithAccountOrganization | null> {
    return db.benchmarkVideo.findFirst({
      where: {
        id,
        deletedAt: null,
        account: {
          deletedAt: null,
        },
      },
      include: {
        account: {
          include: {
            organization: true,
          },
        },
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
      collectCount?: number;
      admireCount?: number;
      recommendCount?: number;
    },
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkVideo> {
    return db.benchmarkVideo.update({
      where: {
        id,
      },
      data,
    });
  }
}

export const benchmarkVideoRepository = new BenchmarkVideoRepository();