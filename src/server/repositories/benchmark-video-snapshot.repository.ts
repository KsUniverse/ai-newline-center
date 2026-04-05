import type { BenchmarkVideoSnapshot, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

class BenchmarkVideoSnapshotRepository {
  async create(
    data: {
      videoId: string;
      playsCount: number;
      likesCount: number;
      commentsCount: number;
      sharesCount: number;
    },
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkVideoSnapshot> {
    return db.benchmarkVideoSnapshot.create({
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
  ): Promise<BenchmarkVideoSnapshot[]> {
    const { videoId, startTime, endTime, limit } = params;

    return db.benchmarkVideoSnapshot.findMany({
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

export const benchmarkVideoSnapshotRepository = new BenchmarkVideoSnapshotRepository();