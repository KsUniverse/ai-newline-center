import type { Prisma, PrismaClient, VideoSnapshot } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

class VideoSnapshotRepository {
  async create(
    data: {
      videoId: string;
      playsCount: number;
      likesCount: number;
      commentsCount: number;
      sharesCount: number;
    },
    db: DatabaseClient = prisma,
  ): Promise<VideoSnapshot> {
    return db.videoSnapshot.create({
      data,
    });
  }

  async findByVideoId(
    params: {
      videoId: string;
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    },
    db: DatabaseClient = prisma,
  ): Promise<VideoSnapshot[]> {
    const { videoId, startTime, endTime, limit } = params;

    return db.videoSnapshot.findMany({
      where: {
        videoId,
        ...(startTime || endTime
          ? {
              timestamp: {
                ...(startTime ? { gte: startTime } : {}),
                ...(endTime ? { lte: endTime } : {}),
              },
            }
          : {}),
      },
      orderBy: {
        timestamp: "desc",
      },
      ...(limit ? { take: limit } : {}),
    });
  }
}

export const videoSnapshotRepository = new VideoSnapshotRepository();
