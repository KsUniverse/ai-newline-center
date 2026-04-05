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
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM employee_collection_videos
        WHERE "accountId" = ${accountId}
      ) AS "exists"
    `;

    return rows[0]?.exists ?? false;
  }

  async existsByAccountAndAwemeId(accountId: string, awemeId: string): Promise<boolean> {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM employee_collection_videos
        WHERE "accountId" = ${accountId}
          AND "awemeId" = ${awemeId}
      ) AS "exists"
    `;

    return rows[0]?.exists ?? false;
  }

  async create(record: CreateEmployeeCollectionVideoRecord): Promise<void> {
    const id = cuid();
    await prisma.$executeRaw`
      INSERT INTO employee_collection_videos ("id", "accountId", "awemeId", "authorSecUserId")
      VALUES (${id}, ${record.accountId}, ${record.awemeId}, ${record.authorSecUserId})
      ON CONFLICT ("accountId", "awemeId") DO NOTHING
    `;
  }

  async deleteByAccountIds(accountIds: string[]): Promise<void> {
    if (accountIds.length === 0) {
      return;
    }

    await prisma.$executeRaw`
      DELETE FROM employee_collection_videos
      WHERE "accountId" = ANY(${accountIds}::text[])
    `;
  }

  async findRecentByAccountId(accountId: string, limit: number): Promise<EmployeeCollectionVideoRecord[]> {
    return prisma.$queryRaw<EmployeeCollectionVideoRecord[]>`
      SELECT "id", "accountId", "awemeId", "authorSecUserId", "createdAt"
      FROM employee_collection_videos
      WHERE "accountId" = ${accountId}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `;
  }
}

export const employeeCollectionVideoRepository = new EmployeeCollectionVideoRepository();
