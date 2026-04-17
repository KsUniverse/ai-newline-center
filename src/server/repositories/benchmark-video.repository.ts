import type { BenchmarkVideo, BenchmarkVideoTag, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { DashboardVideoSortBy } from "@/types/benchmark-video";

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
  private encodeDashboardCursor(
    sortBy: DashboardVideoSortBy,
    item: {
      id: string;
      likeCount: number;
      publishedAt: Date | null;
    },
  ): string | null {
    if (sortBy === "time") {
      if (!item.publishedAt) {
        return null;
      }

      return Buffer.from(
        JSON.stringify({
          publishedAt: item.publishedAt.toISOString(),
          id: item.id,
        }),
      ).toString("base64url");
    }

    return `${item.likeCount}_${item.id}`;
  }

  async upsertByVideoId(
    data: {
      videoId: string;
      accountId: string;
      organizationId: string;
      title: string;
      shareUrl?: string | null;
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
        shareUrl: data.shareUrl,
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
      shareUrl?: string | null;
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

  async updateShareUrl(
    id: string,
    shareUrl: string,
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkVideo> {
    return db.benchmarkVideo.update({
      where: {
        id,
      },
      data: {
        shareUrl,
      },
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

  async findDashboardVideos(
    params: {
      organizationId?: string;
      publishedAtGte?: Date;
      publishedAtLt?: Date;
      sortBy: DashboardVideoSortBy;
      customTag?: BenchmarkVideoTag | null;
      isBringOrder?: boolean;
      cursor?: string;
      limit: number;
    },
    db: DatabaseClient = prisma,
  ): Promise<{
    items: Array<{
      id: string;
      videoId: string;
      title: string;
      coverUrl: string | null;      videoUrl: string | null;      likeCount: number;
      publishedAt: Date | null;
      customTag: BenchmarkVideoTag | null;
      isBringOrder: boolean;
      account: { id: string; nickname: string; avatar: string };
    }>;
    nextCursor: string | null;
    total: number;
  }> {
    const where: Prisma.BenchmarkVideoWhereInput = {
      deletedAt: null,
      account: { deletedAt: null },
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
      ...(params.publishedAtGte || params.publishedAtLt
        ? {
            publishedAt: {
              ...(params.publishedAtGte ? { gte: params.publishedAtGte } : {}),
              ...(params.publishedAtLt ? { lt: params.publishedAtLt } : {}),
            },
          }
        : {}),
      ...(params.customTag !== undefined ? { customTag: params.customTag } : {}),
      ...(params.isBringOrder !== undefined ? { isBringOrder: params.isBringOrder } : {}),
    };

    let cursorWhere: Prisma.BenchmarkVideoWhereInput | undefined;
    if (params.cursor) {
      if (params.sortBy === "time") {
        try {
          const decoded = JSON.parse(
            Buffer.from(params.cursor, "base64url").toString("utf8"),
          ) as { publishedAt?: string; id?: string };
          const cursorPublishedAt =
            decoded.publishedAt ? new Date(decoded.publishedAt) : null;

          if (
            cursorPublishedAt &&
            !Number.isNaN(cursorPublishedAt.getTime()) &&
            decoded.id
          ) {
            cursorWhere = {
              OR: [
                { publishedAt: { lt: cursorPublishedAt } },
                { publishedAt: cursorPublishedAt, id: { gt: decoded.id } },
              ],
            };
          }
        } catch {}
      } else {
        const parts = params.cursor.split("_");
        const firstPart = parts[0];
        const cursorLikeCount = firstPart !== undefined ? parseInt(firstPart, 10) : NaN;
        const cursorId = parts.slice(1).join("_");
        if (!isNaN(cursorLikeCount) && cursorId) {
          cursorWhere = {
            OR: [
              { likeCount: { lt: cursorLikeCount } },
              { likeCount: cursorLikeCount, id: { gt: cursorId } },
            ],
          };
        }
      }
    }

    const finalWhere: Prisma.BenchmarkVideoWhereInput = cursorWhere
      ? { AND: [where, cursorWhere] }
      : where;

    const orderBy: Prisma.BenchmarkVideoOrderByWithRelationInput[] =
      params.sortBy === "time"
        ? [{ publishedAt: "desc" }, { id: "asc" }]
        : [{ likeCount: "desc" }, { id: "asc" }];

    const [items, total] = await Promise.all([
      db.benchmarkVideo.findMany({
        where: finalWhere,
        orderBy,
        take: params.limit + 1,
        select: {
          id: true,
          videoId: true,
          title: true,
          coverUrl: true,
          videoUrl: true,
          likeCount: true,
          publishedAt: true,
          customTag: true,
          isBringOrder: true,
          account: {
            select: { id: true, nickname: true, avatar: true },
          },
        },
      }),
      db.benchmarkVideo.count({ where }),
    ]);

    let nextCursor: string | null = null;
    if (items.length > params.limit) {
      items.pop();
      const last = items[items.length - 1];
      if (last) {
        nextCursor = this.encodeDashboardCursor(params.sortBy, last);
      }
    }

    return { items, nextCursor, total };
  }

  private async findActiveForUpdate(
    id: string,
    organizationId: string | undefined,
    db: DatabaseClient,
  ): Promise<BenchmarkVideo> {
    const video = await db.benchmarkVideo.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(organizationId ? { organizationId } : {}),
      },
    });

    if (!video) {
      throw new Error("VIDEO_NOT_FOUND");
    }

    return video;
  }

  async updateCustomTag(
    id: string,
    organizationId: string | undefined,
    customTag: BenchmarkVideoTag | null,
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkVideo> {
    const video = await this.findActiveForUpdate(id, organizationId, db);
    return db.benchmarkVideo.update({
      where: { id: video.id },
      data: { customTag },
    });
  }

  async updateBringOrder(
    id: string,
    organizationId: string | undefined,
    isBringOrder: boolean,
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkVideo> {
    const video = await this.findActiveForUpdate(id, organizationId, db);
    return db.benchmarkVideo.update({
      where: { id: video.id },
      data: { isBringOrder },
    });
  }
}

export const benchmarkVideoRepository = new BenchmarkVideoRepository();
