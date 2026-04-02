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

  async create(
    data: {
      profileUrl: string;
      nickname: string;
      avatar: string;
      bio?: string | null;
      followersCount: number;
      videosCount: number;
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
}

export const douyinAccountRepository = new DouyinAccountRepository();
