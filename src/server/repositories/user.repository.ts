import type { Prisma, PrismaClient, User, UserStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type UserWithOrganization = Prisma.UserGetPayload<{
  include: { organization: true };
}>;

type PaginatedUsers = {
  items: UserWithOrganization[];
  total: number;
  page: number;
  limit: number;
};

class UserRepository {
  async findByAccount(account: string, db: DatabaseClient = prisma): Promise<User | null> {
    return db.user.findFirst({
      where: {
        account,
        deletedAt: null,
      },
    });
  }

  async findById(id: string, db: DatabaseClient = prisma): Promise<UserWithOrganization | null> {
    return db.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        organization: true,
      },
    });
  }

  async list(
    params: { organizationId?: string; page: number; limit: number },
    db: DatabaseClient = prisma,
  ): Promise<PaginatedUsers> {
    const { organizationId, page, limit } = params;
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(organizationId ? { organizationId } : {}),
    };

    const [items, total] = await Promise.all([
      db.user.findMany({
        where,
        include: {
          organization: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async create(
    data: {
      account: string;
      passwordHash: string;
      name: string;
      role: Prisma.UserCreateInput["role"];
      organizationId: string;
    },
    db: DatabaseClient = prisma,
  ): Promise<User> {
    return db.user.create({
      data,
    });
  }

  async update(
    id: string,
    data: { name?: string; role?: Prisma.UserUpdateInput["role"] },
    db: DatabaseClient = prisma,
  ): Promise<User> {
    return db.user.update({
      where: { id },
      data,
    });
  }

  async setStatus(
    id: string,
    status: UserStatus,
    db: DatabaseClient = prisma,
  ): Promise<User> {
    return db.user.update({
      where: { id },
      data: { status },
    });
  }
}

export const userRepository = new UserRepository();
