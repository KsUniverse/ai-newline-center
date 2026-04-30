import type { DouyinAccountStyleProfile, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

interface UpsertStyleProfileData {
  targetAccountId: string;
  organizationId: string;
  summary: string | null;
  toneKeywords: Prisma.InputJsonValue;
  structurePatterns: Prisma.InputJsonValue;
  openingPatterns: Prisma.InputJsonValue;
  ctaPatterns: Prisma.InputJsonValue;
  avoidPatterns: Prisma.InputJsonValue;
  sampleCount: number;
  lastBuiltAt: Date | null;
}

class DouyinAccountStyleProfileRepository {
  async upsert(
    data: UpsertStyleProfileData,
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccountStyleProfile> {
    return db.douyinAccountStyleProfile.upsert({
      where: { targetAccountId: data.targetAccountId },
      create: {
        targetAccountId: data.targetAccountId,
        organizationId: data.organizationId,
        summary: data.summary,
        toneKeywords: data.toneKeywords,
        structurePatterns: data.structurePatterns,
        openingPatterns: data.openingPatterns,
        ctaPatterns: data.ctaPatterns,
        avoidPatterns: data.avoidPatterns,
        sampleCount: data.sampleCount,
        lastBuiltAt: data.lastBuiltAt,
      },
      update: {
        organizationId: data.organizationId,
        summary: data.summary,
        toneKeywords: data.toneKeywords,
        structurePatterns: data.structurePatterns,
        openingPatterns: data.openingPatterns,
        ctaPatterns: data.ctaPatterns,
        avoidPatterns: data.avoidPatterns,
        sampleCount: data.sampleCount,
        lastBuiltAt: data.lastBuiltAt,
      },
    });
  }

  async findByTargetAccountId(
    targetAccountId: string,
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccountStyleProfile | null> {
    return db.douyinAccountStyleProfile.findUnique({
      where: { targetAccountId },
    });
  }
}

export const douyinAccountStyleProfileRepository =
  new DouyinAccountStyleProfileRepository();
