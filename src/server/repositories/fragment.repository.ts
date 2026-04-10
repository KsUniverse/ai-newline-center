import type { Prisma, PrismaClient } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { resolveFragmentCreatedAtFilter } from "@/server/services/fragment-time-scope";
import type { FragmentScope } from "@/types/fragment";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const createdByUserInclude = {
  createdByUser: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.FragmentInclude;

export type FragmentWithCreator = Prisma.FragmentGetPayload<{
  include: typeof createdByUserInclude;
}>;

export interface FindManyFragmentsParams {
  organizationId: string;
  q?: string;
  cursor?: string;
  limit: number;
  scope: FragmentScope;
}

export interface CreateFragmentRecord {
  content: string;
  organizationId: string;
  createdByUserId: string;
}

interface CursorValue {
  c: string;
  i: string;
}

class FragmentRepository {
  private decodeCursor(cursor: string): CursorValue {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<CursorValue>;

      if (typeof parsed.c !== "string" || typeof parsed.i !== "string") {
        throw new Error("Invalid fragment cursor");
      }

      if (Number.isNaN(Date.parse(parsed.c))) {
        throw new Error("Invalid fragment cursor");
      }

      return parsed as CursorValue;
    } catch {
      throw new AppError("VALIDATION_ERROR", "无效的游标", 400);
    }
  }

  private encodeCursor(createdAt: Date, id: string): string {
    return Buffer.from(
      JSON.stringify({
        c: createdAt.toISOString(),
        i: id,
      }),
    ).toString("base64url");
  }

  private buildWhere(params: {
    organizationId: string;
    q?: string;
    cursor?: string;
    scope: FragmentScope;
  }): Prisma.FragmentWhereInput {
    const where: Prisma.FragmentWhereInput = {
      organizationId: params.organizationId,
      deletedAt: null,
      createdAt: resolveFragmentCreatedAtFilter(params.scope),
      ...(params.q ? { content: { contains: params.q } } : {}),
    };

    if (!params.cursor) {
      return where;
    }

    const cursor = this.decodeCursor(params.cursor);
    const cursorCreatedAt = new Date(cursor.c);

    return {
      ...where,
      OR: [
        {
          createdAt: {
            lt: cursorCreatedAt,
          },
        },
        {
          AND: [
            {
              createdAt: cursorCreatedAt,
            },
            {
              id: {
                lt: cursor.i,
              },
            },
          ],
        },
      ],
    };
  }

  async findMany(
    params: FindManyFragmentsParams,
    db: DatabaseClient = prisma,
  ): Promise<{
    items: FragmentWithCreator[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const rows = await db.fragment.findMany({
      where: this.buildWhere({
        organizationId: params.organizationId,
        q: params.q,
        cursor: params.cursor,
        scope: params.scope,
      }),
      include: createdByUserInclude,
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      take: params.limit + 1,
    });

    const hasMore = rows.length > params.limit;
    const items = hasMore ? rows.slice(0, params.limit) : rows;
    const lastItem = items[items.length - 1];

    return {
      items,
      hasMore,
      nextCursor: hasMore && lastItem ? this.encodeCursor(lastItem.createdAt, lastItem.id) : null,
    };
  }

  async create(
    data: CreateFragmentRecord,
    db: DatabaseClient = prisma,
  ): Promise<FragmentWithCreator> {
    return db.fragment.create({
      data,
      include: createdByUserInclude,
    });
  }

  async createManyPrecisely(items: CreateFragmentRecord[]): Promise<FragmentWithCreator[]> {
    return prisma.$transaction(async (tx) => {
      const created: FragmentWithCreator[] = [];

      for (const item of items) {
        created.push(await this.create(item, tx));
      }

      return created;
    });
  }

  async findById(
    id: string,
    organizationId: string,
    db: DatabaseClient = prisma,
  ): Promise<FragmentWithCreator | null> {
    return db.fragment.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: createdByUserInclude,
    });
  }

  async softDelete(
    params: { id: string; organizationId: string },
    db: DatabaseClient = prisma,
  ): Promise<boolean> {
    const result = await db.fragment.updateMany({
      where: {
        id: params.id,
        organizationId: params.organizationId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return result.count > 0;
  }
}

export const fragmentRepository = new FragmentRepository();
