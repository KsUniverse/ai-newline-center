import {
  BenchmarkAccountMemberSource,
  type BenchmarkAccount,
  type BenchmarkAccountMember,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
type ArchiveFilter = "active" | "archived" | "all";

const createdByUserInclude = {
  createdByUser: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.BenchmarkAccountInclude;

export type BenchmarkAccountWithCreator = Prisma.BenchmarkAccountGetPayload<{
  include: typeof createdByUserInclude;
}>;

export interface FindManyBenchmarkAccountsParams {
  organizationId?: string;
  page: number;
  limit: number;
  archiveFilter?: ArchiveFilter;
}

interface BuildBenchmarkWhereParams {
  id?: string;
  organizationId?: string;
  profileUrl?: string;
  secUserId?: string;
  archiveFilter?: ArchiveFilter;
}

interface CreateBenchmarkAccountRecord {
  profileUrl: string;
  secUserId: string;
  nickname: string;
  avatar: string;
  bio?: string | null;
  signature?: string | null;
  followersCount: number;
  followingCount: number;
  likesCount: number;
  videosCount: number;
  douyinNumber?: string | null;
  ipLocation?: string | null;
  age?: number | null;
  province?: string | null;
  city?: string | null;
  verificationLabel?: string | null;
  verificationIconUrl?: string | null;
  verificationType?: number | null;
  createdByUserId: string;
  organizationId: string;
  lastSyncedAt?: Date | null;
}

interface UpsertBenchmarkMemberRecord {
  benchmarkAccountId: string;
  userId: string;
  organizationId: string;
  source: BenchmarkAccountMemberSource;
}

class BenchmarkAccountRepository {
  private buildWhere(params: BuildBenchmarkWhereParams): Prisma.BenchmarkAccountWhereInput {
    const {
      id,
      organizationId,
      profileUrl,
      secUserId,
      archiveFilter = "active",
    } = params;

    return {
      ...(id ? { id } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(profileUrl ? { profileUrl } : {}),
      ...(secUserId ? { secUserId } : {}),
      ...this.buildArchiveWhere(archiveFilter),
    };
  }

  private buildArchiveWhere(archiveFilter: ArchiveFilter): Prisma.BenchmarkAccountWhereInput {
    switch (archiveFilter) {
      case "archived":
        return { deletedAt: { not: null } };
      case "all":
        return {};
      case "active":
      default:
        return { deletedAt: null };
    }
  }

  async findAll(db: DatabaseClient = prisma): Promise<BenchmarkAccount[]> {
    return db.benchmarkAccount.findMany({
      where: this.buildWhere({ archiveFilter: "active" }),
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async findByOrganizationAndSecUserIdIncludingDeleted(
    organizationId: string,
    secUserId: string,
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkAccount | null> {
    return db.benchmarkAccount.findFirst({
      where: this.buildWhere({
        organizationId,
        secUserId,
        archiveFilter: "all",
      }),
    });
  }

  async findByOrganizationAndProfileUrlIncludingDeleted(
    organizationId: string,
    profileUrl: string,
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkAccount | null> {
    return db.benchmarkAccount.findFirst({
      where: this.buildWhere({
        organizationId,
        profileUrl,
        archiveFilter: "all",
      }),
    });
  }

  async findById(
    id: string,
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkAccountWithCreator | null> {
    return db.benchmarkAccount.findFirst({
      where: this.buildWhere({
        id,
        archiveFilter: "all",
      }),
      include: createdByUserInclude,
    });
  }

  async findMany(
    params: FindManyBenchmarkAccountsParams,
    db: DatabaseClient = prisma,
  ): Promise<{ items: BenchmarkAccountWithCreator[]; total: number; page: number; limit: number }> {
    const { organizationId, archiveFilter = "active", page, limit } = params;
    const where = this.buildWhere({
      organizationId,
      archiveFilter,
    });

    const [items, total] = await Promise.all([
      db.benchmarkAccount.findMany({
        where,
        include: createdByUserInclude,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.benchmarkAccount.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async create(
    data: CreateBenchmarkAccountRecord,
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkAccount> {
    return db.benchmarkAccount.create({
      data,
    });
  }

  async createWithMember(
    data: CreateBenchmarkAccountRecord,
    source: BenchmarkAccountMemberSource,
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkAccount> {
    const created = await this.create(data, db);
    await this.upsertMember(
      {
        benchmarkAccountId: created.id,
        userId: data.createdByUserId,
        organizationId: data.organizationId,
        source,
      },
      db,
    );

    return created;
  }

  async upsertMember(
    data: UpsertBenchmarkMemberRecord,
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkAccountMember> {
    return db.benchmarkAccountMember.upsert({
      where: {
        benchmarkAccountId_userId: {
          benchmarkAccountId: data.benchmarkAccountId,
          userId: data.userId,
        },
      },
      create: data,
      update: {
        source: data.source,
        organizationId: data.organizationId,
      },
    });
  }

  async hasMember(
    benchmarkAccountId: string,
    userId: string,
    db: DatabaseClient = prisma,
  ): Promise<boolean> {
    const record = await db.benchmarkAccountMember.findUnique({
      where: {
        benchmarkAccountId_userId: {
          benchmarkAccountId,
          userId,
        },
      },
      select: {
        benchmarkAccountId: true,
      },
    });

    return record !== null;
  }

  async archive(id: string, db: DatabaseClient = prisma): Promise<BenchmarkAccount> {
    return db.benchmarkAccount.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async updateSecUserId(
    id: string,
    secUserId: string,
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkAccount> {
    return db.benchmarkAccount.update({
      where: {
        id,
      },
      data: {
        secUserId,
      },
    });
  }

  async updateAccountInfo(
    id: string,
    data: {
      nickname: string;
      avatar: string;
      bio: string | null;
      signature: string | null;
      followersCount: number;
      followingCount: number;
      likesCount: number;
      videosCount: number;
      douyinNumber: string | null;
      ipLocation: string | null;
      age: number | null;
      province: string | null;
      city: string | null;
      verificationLabel: string | null;
      verificationIconUrl: string | null;
      verificationType: number | null;
      bannedAt?: Date | null;
      lastSyncedAt: Date;
    },
    db: DatabaseClient = prisma,
  ): Promise<BenchmarkAccount> {
    return db.benchmarkAccount.update({
      where: {
        id,
      },
      data,
    });
  }

  async findBannedAccounts(
    params: {
      organizationId: string;
      bannedAtGte?: Date;
      bannedAtLt?: Date;
    },
    db: DatabaseClient = prisma,
  ): Promise<
    Array<{
      id: string;
      nickname: string;
      avatar: string;
      douyinNumber: string | null;
      bannedAt: Date;
    }>
  > {
    const results = await db.benchmarkAccount.findMany({
      where: {
        organizationId: params.organizationId,
        deletedAt: null,
        bannedAt: {
          not: null,
          ...(params.bannedAtGte ? { gte: params.bannedAtGte } : {}),
          ...(params.bannedAtLt ? { lt: params.bannedAtLt } : {}),
        },
      },
      orderBy: { bannedAt: "desc" },
      take: 100,
      select: {
        id: true,
        nickname: true,
        avatar: true,
        douyinNumber: true,
        bannedAt: true,
      },
    });

    return results.filter((r) => r.bannedAt !== null) as Array<{
      id: string;
      nickname: string;
      avatar: string;
      douyinNumber: string | null;
      bannedAt: Date;
    }>;
  }
}

export const benchmarkAccountRepository = new BenchmarkAccountRepository();
