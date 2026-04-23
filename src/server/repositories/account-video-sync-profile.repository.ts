import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export interface AccountVideoSyncProfileRecord {
  accountType: "MY_ACCOUNT" | "BENCHMARK_ACCOUNT";
  accountId: string;
  organizationId: string;
  status: "ACTIVE" | "COOLDOWN" | "LOW_ACTIVITY" | "STOPPED_BANNED";
  priority: number;
  nextSyncAt: Date | null;
  cooldownUntil: Date | null;
  fastFollowUntil: Date | null;
  lastVideoPublishedAt: Date | null;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  consecutiveFailureCount: number;
  consecutiveNoNewCount: number;
  publishWindowsJson: Prisma.JsonValue;
  hourlyDistributionJson: Prisma.JsonValue;
  notes: Prisma.JsonValue | null;
}

export interface UpsertAccountVideoSyncProfileStateInput
  extends Omit<AccountVideoSyncProfileRecord, "publishWindowsJson" | "hourlyDistributionJson" | "notes"> {
  publishWindowsJson: Prisma.InputJsonValue;
  hourlyDistributionJson: Prisma.InputJsonValue;
  notes?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
}

export interface EnsureAccountVideoSyncProfileInput {
  accountType: "MY_ACCOUNT" | "BENCHMARK_ACCOUNT";
  accountId: string;
  organizationId: string;
  status?: "ACTIVE" | "COOLDOWN" | "LOW_ACTIVITY" | "STOPPED_BANNED";
  priority?: number;
  nextSyncAt?: Date | null;
  publishWindowsJson?: Prisma.InputJsonValue;
  hourlyDistributionJson?: Prisma.InputJsonValue;
  notes?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
}

function toNullableJsonInput(
  value: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value;
}

class AccountVideoSyncProfileRepository {
  async ensureProfiles(
    items: EnsureAccountVideoSyncProfileInput[],
    db: DatabaseClient = prisma,
  ): Promise<void> {
    for (const item of items) {
      await db.accountVideoSyncProfile.upsert({
        where: {
          accountType_accountId: {
            accountType: item.accountType,
            accountId: item.accountId,
          },
        },
        create: {
          accountType: item.accountType,
          accountId: item.accountId,
          organizationId: item.organizationId,
          status: item.status ?? "ACTIVE",
          priority: item.priority ?? 0,
          nextSyncAt: item.nextSyncAt ?? new Date(),
          publishWindowsJson: item.publishWindowsJson ?? [],
          hourlyDistributionJson: item.hourlyDistributionJson ?? [],
          notes: toNullableJsonInput(item.notes),
        },
        update: {
          organizationId: item.organizationId,
        },
      });
    }
  }

  async findDueProfiles(
    now: Date,
    limit: number,
    db: DatabaseClient = prisma,
  ): Promise<AccountVideoSyncProfileRecord[]> {
    return db.accountVideoSyncProfile.findMany({
      where: {
        status: {
          not: "STOPPED_BANNED",
        },
        nextSyncAt: {
          lte: now,
        },
      },
      orderBy: [{ nextSyncAt: "asc" }, { priority: "desc" }],
      take: limit,
    });
  }

  async findNearestScheduledProfile(
    db: DatabaseClient = prisma,
  ): Promise<AccountVideoSyncProfileRecord | null> {
    return db.accountVideoSyncProfile.findFirst({
      where: {
        status: {
          not: "STOPPED_BANNED",
        },
        nextSyncAt: {
          not: null,
        },
      },
      orderBy: [{ nextSyncAt: "asc" }, { priority: "desc" }],
    });
  }

  async findByAccount(
    accountType: "MY_ACCOUNT" | "BENCHMARK_ACCOUNT",
    accountId: string,
    db: DatabaseClient = prisma,
  ): Promise<AccountVideoSyncProfileRecord | null> {
    return db.accountVideoSyncProfile.findUnique({
      where: {
        accountType_accountId: {
          accountType,
          accountId,
        },
      },
    });
  }

  async upsertState(
    input: UpsertAccountVideoSyncProfileStateInput,
    db: DatabaseClient = prisma,
  ): Promise<void> {
    await db.accountVideoSyncProfile.upsert({
      where: {
        accountType_accountId: {
          accountType: input.accountType,
          accountId: input.accountId,
        },
      },
      create: {
        accountType: input.accountType,
        accountId: input.accountId,
        organizationId: input.organizationId,
        status: input.status,
        priority: input.priority,
        nextSyncAt: input.nextSyncAt,
        cooldownUntil: input.cooldownUntil,
        fastFollowUntil: input.fastFollowUntil,
        lastVideoPublishedAt: input.lastVideoPublishedAt,
        lastAttemptAt: input.lastAttemptAt,
        lastSuccessAt: input.lastSuccessAt,
        lastFailureAt: input.lastFailureAt,
        consecutiveFailureCount: input.consecutiveFailureCount,
        consecutiveNoNewCount: input.consecutiveNoNewCount,
        publishWindowsJson: input.publishWindowsJson,
        hourlyDistributionJson: input.hourlyDistributionJson,
        notes: toNullableJsonInput(input.notes),
      },
      update: {
        organizationId: input.organizationId,
        status: input.status,
        priority: input.priority,
        nextSyncAt: input.nextSyncAt,
        cooldownUntil: input.cooldownUntil,
        fastFollowUntil: input.fastFollowUntil,
        lastVideoPublishedAt: input.lastVideoPublishedAt,
        lastAttemptAt: input.lastAttemptAt,
        lastSuccessAt: input.lastSuccessAt,
        lastFailureAt: input.lastFailureAt,
        consecutiveFailureCount: input.consecutiveFailureCount,
        consecutiveNoNewCount: input.consecutiveNoNewCount,
        publishWindowsJson: input.publishWindowsJson,
        hourlyDistributionJson: input.hourlyDistributionJson,
        notes: toNullableJsonInput(input.notes),
      },
    });
  }
}

export const accountVideoSyncProfileRepository =
  new AccountVideoSyncProfileRepository();
