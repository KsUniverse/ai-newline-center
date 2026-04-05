import {
  DouyinAccountLoginStatus,
  type DouyinAccount,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
type ArchiveFilter = "active" | "archived" | "all";

const loginStateMetaSelect = {
  id: true,
  userId: true,
  organizationId: true,
  loginStatus: true,
  loginStatePath: true,
  loginStateUpdatedAt: true,
  loginStateCheckedAt: true,
  loginStateExpiresAt: true,
  loginErrorMessage: true,
  favoriteCookieHeader: true,
} satisfies Prisma.DouyinAccountSelect;

const userInclude = {
  user: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.DouyinAccountInclude;

export type DouyinAccountWithUser = Prisma.DouyinAccountGetPayload<{
  include: typeof userInclude;
}>;

export type DouyinAccountLoginStateMeta = Prisma.DouyinAccountGetPayload<{
  select: typeof loginStateMetaSelect;
}>;

export interface FindManyDouyinAccountsParams {
  userId?: string;
  organizationId?: string;
  page: number;
  limit: number;
  archiveFilter?: ArchiveFilter;
}

interface BuildAccountWhereParams {
  id?: string;
  profileUrl?: string;
  secUserId?: string;
  userId?: string;
  organizationId?: string;
  requireSecUserId?: boolean;
  archiveFilter?: ArchiveFilter;
}

interface CreateDouyinAccountRecord {
  id?: string;
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
  loginStatus?: DouyinAccountLoginStatus;
  loginStatePath?: string | null;
  loginStateUpdatedAt?: Date | null;
  loginStateCheckedAt?: Date | null;
  loginStateExpiresAt?: Date | null;
  loginErrorMessage?: string | null;
  favoriteCookieHeader?: string | null;
  lastSyncedAt?: Date | null;
  userId: string;
  organizationId: string;
}

class DouyinAccountRepository {
  private buildWhere(params: BuildAccountWhereParams): Prisma.DouyinAccountWhereInput {
    const {
      id,
      profileUrl,
      secUserId,
      userId,
      organizationId,
      requireSecUserId,
      archiveFilter = "active",
    } = params;

    return {
      ...(id ? { id } : {}),
      ...(profileUrl ? { profileUrl } : {}),
      ...(secUserId ? { secUserId } : {}),
      ...(userId ? { userId } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(requireSecUserId ? { secUserId: { not: null } } : {}),
      ...this.buildArchiveWhere(archiveFilter),
    };
  }

  private buildArchiveWhere(archiveFilter: ArchiveFilter): Prisma.DouyinAccountWhereInput {
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

  async findAll(db: DatabaseClient = prisma): Promise<DouyinAccount[]> {
    return db.douyinAccount.findMany({
      where: this.buildWhere({ archiveFilter: "active" }),
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async findAllMyAccountsForCollection(db: DatabaseClient = prisma): Promise<DouyinAccount[]> {
    return db.douyinAccount.findMany({
      where: this.buildWhere({
        requireSecUserId: true,
        archiveFilter: "active",
      }),
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async findByProfileUrl(
    profileUrl: string,
    includingDeleted = false,
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccount | null> {
    return db.douyinAccount.findFirst({
      where: this.buildWhere({
        profileUrl,
        archiveFilter: includingDeleted ? "all" : "active",
      }),
    });
  }

  async findBySecUserIdIncludingDeleted(
    secUserId: string,
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccount | null> {
    return db.douyinAccount.findFirst({
      where: this.buildWhere({
        secUserId,
        archiveFilter: "all",
      }),
    });
  }

  async findById(
    id: string,
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccountWithUser | null> {
    return db.douyinAccount.findFirst({
      where: this.buildWhere({
        id,
        archiveFilter: "active",
      }),
      include: userInclude,
    });
  }

  async findOwnedMyAccount(
    id: string,
    userId: string,
    organizationId: string,
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccount | null> {
    return db.douyinAccount.findFirst({
      where: this.buildWhere({
        id,
        userId,
        organizationId,
        archiveFilter: "active",
      }),
    });
  }

  async findLoginStateMeta(
    id: string,
    organizationId?: string,
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccountLoginStateMeta | null> {
    return db.douyinAccount.findFirst({
      where: this.buildWhere({
        id,
        organizationId,
        archiveFilter: "active",
      }),
      select: loginStateMetaSelect,
    });
  }

  async findMany(
    params: FindManyDouyinAccountsParams,
    db: DatabaseClient = prisma,
  ): Promise<{ items: DouyinAccount[]; total: number; page: number; limit: number }> {
    const { userId, organizationId, page, limit } = params;
    const where = this.buildWhere({
      userId,
      organizationId,
      archiveFilter: params.archiveFilter ?? "active",
    });

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
      where: this.buildWhere({
        userId,
        archiveFilter: "active",
      }),
      select: {
        id: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return accounts.map((account) => account.id);
  }

  async findMyAccountIdsByUserId(userId: string, db: DatabaseClient = prisma): Promise<string[]> {
    return this.findIdsByUserId(userId, db);
  }

  async findIdsByOrganizationId(
    organizationId: string,
    db: DatabaseClient = prisma,
  ): Promise<string[]> {
    const accounts = await db.douyinAccount.findMany({
      where: this.buildWhere({
        organizationId,
        archiveFilter: "active",
      }),
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
    data: CreateDouyinAccountRecord,
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

  async updateLoginStatus(
    id: string,
    loginStatus: DouyinAccountLoginStatus,
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccount> {
    return db.douyinAccount.update({
      where: {
        id,
      },
      data: {
        loginStatus,
      },
    });
  }

  async updateLoginStateBinding(
    id: string,
    data: {
      loginStatus?: DouyinAccountLoginStatus;
      loginStatePath?: string | null;
      loginStateUpdatedAt?: Date | null;
      loginStateCheckedAt?: Date | null;
      loginStateExpiresAt?: Date | null;
      loginErrorMessage?: string | null;
      favoriteCookieHeader?: string | null;
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

  async clearLoginStateBinding(
    id: string,
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccount> {
    return db.douyinAccount.update({
      where: {
        id,
      },
      data: {
        loginStatus: DouyinAccountLoginStatus.NOT_LOGGED_IN,
        loginStatePath: null,
        loginStateUpdatedAt: null,
        loginStateCheckedAt: null,
        loginStateExpiresAt: null,
        loginErrorMessage: null,
        favoriteCookieHeader: null,
      },
    });
  }

  async markLoginExpired(
    id: string,
    errorMessage: string | null,
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccount> {
    return db.douyinAccount.update({
      where: {
        id,
      },
      data: {
        loginStatus: DouyinAccountLoginStatus.EXPIRED,
        loginStateCheckedAt: new Date(),
        loginErrorMessage: errorMessage,
      },
    });
  }

  async markLoginFailed(
    id: string,
    errorMessage: string,
    db: DatabaseClient = prisma,
  ): Promise<DouyinAccount> {
    return db.douyinAccount.update({
      where: {
        id,
      },
      data: {
        loginStatus: DouyinAccountLoginStatus.FAILED,
        loginStateCheckedAt: new Date(),
        loginErrorMessage: errorMessage,
      },
    });
  }
}

export const douyinAccountRepository = new DouyinAccountRepository();
