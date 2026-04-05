import cuid from "cuid";

import { prisma } from "@/lib/prisma";

interface CreateEmployeeCollectionVideoRecord {
  accountId: string;
  awemeId: string;
  authorSecUserId: string | null;
}

interface EmployeeCollectionVideoRecord {
  id: string;
  accountId: string;
  awemeId: string;
  authorSecUserId: string | null;
  createdAt: Date;
}

class EmployeeCollectionVideoRepository {
  async existsForAccount(accountId: string): Promise<boolean> {
    const record = await prisma.employeeCollectionVideo.findFirst({
      where: {
        accountId,
      },
      select: {
        id: true,
      },
    });

    return record !== null;
  }

  async existsByAccountAndAwemeId(accountId: string, awemeId: string): Promise<boolean> {
    const record = await prisma.employeeCollectionVideo.findUnique({
      where: {
        accountId_awemeId: {
          accountId,
          awemeId,
        },
      },
      select: {
        id: true,
      },
    });

    return record !== null;
  }

  async create(record: CreateEmployeeCollectionVideoRecord): Promise<void> {
    await prisma.employeeCollectionVideo.createMany({
      data: [
        {
          id: cuid(),
          accountId: record.accountId,
          awemeId: record.awemeId,
          authorSecUserId: record.authorSecUserId,
        },
      ],
      skipDuplicates: true,
    });
  }

  async deleteByAccountIds(accountIds: string[]): Promise<void> {
    if (accountIds.length === 0) {
      return;
    }

    await prisma.employeeCollectionVideo.deleteMany({
      where: {
        accountId: {
          in: accountIds,
        },
      },
    });
  }

  async findRecentByAccountId(accountId: string, limit: number): Promise<EmployeeCollectionVideoRecord[]> {
    return prisma.employeeCollectionVideo.findMany({
      where: {
        accountId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });
  }
}

export const employeeCollectionVideoRepository = new EmployeeCollectionVideoRepository();
