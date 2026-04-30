import type { Prisma, PrismaClient, StyleExperience } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

interface UpsertStyleExperienceData {
  accountId: string;
  rewriteId: string;
  videoId: string;
  aiContent: string;
  finalContent: string;
  playsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  qualityScore: number;
  organizationId: string;
}

class StyleExperienceRepository {
  async upsert(
    data: UpsertStyleExperienceData,
    db: DatabaseClient = prisma,
  ): Promise<StyleExperience> {
    return db.styleExperience.upsert({
      where: { rewriteId_videoId: { rewriteId: data.rewriteId, videoId: data.videoId } },
      create: data,
      update: {
        playsCount: data.playsCount,
        likesCount: data.likesCount,
        commentsCount: data.commentsCount,
        sharesCount: data.sharesCount,
        qualityScore: data.qualityScore,
        finalContent: data.finalContent,
      },
    });
  }

  async findTopByAccountId(
    accountId: string,
    organizationId: string,
    limit: number,
    db: DatabaseClient = prisma,
  ): Promise<StyleExperience[]> {
    return db.styleExperience.findMany({
      where: { accountId, organizationId },
      orderBy: { qualityScore: "desc" },
      take: limit,
    });
  }

  async findByRewriteId(
    rewriteId: string,
    db: DatabaseClient = prisma,
  ): Promise<StyleExperience | null> {
    return db.styleExperience.findFirst({
      where: { rewriteId },
      orderBy: { qualityScore: "desc" },
    });
  }
}

export const styleExperienceRepository = new StyleExperienceRepository();
