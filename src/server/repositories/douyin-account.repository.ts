import type {
  DouyinAccount,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type DouyinAccountWithUser = Prisma.DouyinAccountGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

export interface FindManyDouyinAccountsParams {
  userId?: string;
  organizationId?: string;
  page: number;
  limit: number;
}

class DouyinAccountRepository {
  async findAll(db: DatabaseClient = prisma): Promise<DouyinAccount[]> {
    return db.douyinAccount.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async findByProfileUrl(
    profileUrl: string,
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccount | null> {
    return db.douyinAccount.findFirst({
      where: {
        profileUrl,
        deletedAt: null,
      },
    });
  }

  async findById(
    id: string,
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccountWithUser | null> {
    return db.douyinAccount.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findMany(
    params: FindManyDouyinAccountsParams,
    db: DatabaseClient = prisma,
  ) {
    const { userId, organizationId, page, limit } = params;
    const where: Prisma.DouyinAccountWhereInput = {
      deletedAt: null,
      ...(userId ? { userId } : {}),
      ...(organizationId ? { organizationId } : {}),
    };

    const [items, total] = await Promise.all([
      db.douyinAccount.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.douyinAccount.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findIdsByUserId(userId: string, db: DatabaseClient = prisma): Promise<string[]> {
    const accounts = await db.douyinAccount.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return accounts.map((account) => account.id);
  }

  async findIdsByOrganizationId(
    organizationId: string,
    db: DatabaseClient = prisma,
  ): Promise<string[]> {
    const accounts = await db.douyinAccount.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return accounts.map((account) => account.id);
  }

  async create(
    data: {
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
      userId: string;
      organizationId: string;
      type: "MY_ACCOUNT";
    },
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccount> {
    return db.douyinAccount.create({
      data,
    });
  }

  async updateSecUserId(
    id: string,
    secUserId: string,
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccount> {
    return db.douyinAccount.update({
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
      lastSyncedAt: Date;
    },
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccount> {
    return db.douyinAccount.update({
      where: {
        id,
      },
      data,
    });
  }
}

export const douyinAccountRepository = new DouyinAccountRepository();
