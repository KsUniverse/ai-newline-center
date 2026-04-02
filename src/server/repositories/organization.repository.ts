import type { Organization, OrganizationStatus, Prisma, PrismaClient, UserStatus } from "@prisma/client";
import { OrganizationType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type BranchWithUserCount = Prisma.OrganizationGetPayload<{
  include: {
    _count: {
      select: {
        users: true;
      };
    };
  };
}>;

export type OrganizationWithUserCount = Prisma.OrganizationGetPayload<{
  include: {
    _count: {
      select: {
        users: true;
      };
    };
  };
}>;

class OrganizationRepository {
  async findGroupOrg(db: DatabaseClient = prisma): Promise<Organization | null> {
    return db.organization.findFirst({
      where: {
        type: OrganizationType.GROUP,
        deletedAt: null,
      },
    });
  }

  async findAllBranches(db: DatabaseClient = prisma): Promise<BranchWithUserCount[]> {
    return db.organization.findMany({
      where: {
        type: OrganizationType.BRANCH,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findById(id: string, db: DatabaseClient = prisma): Promise<OrganizationWithUserCount | null> {
    return db.organization.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });
  }

  async create(
    data: { name: string; parentId: string },
    db: DatabaseClient = prisma,
  ): Promise<Organization> {
    return db.organization.create({
      data: {
        name: data.name,
        parentId: data.parentId,
        type: OrganizationType.BRANCH,
      },
    });
  }

  async update(
    id: string,
    data: { name?: string; status?: OrganizationStatus },
    db: DatabaseClient = prisma,
  ): Promise<Organization> {
    return db.organization.update({
      where: { id },
      data,
    });
  }

  async findByName(
    name: string,
    excludeId?: string,
    db: DatabaseClient = prisma,
  ): Promise<Organization | null> {
    return db.organization.findFirst({
      where: {
        name,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async countActiveUsers(
    organizationId: string,
    status: UserStatus,
    db: DatabaseClient = prisma,
  ): Promise<number> {
    return db.user.count({
      where: {
        organizationId,
        status,
        deletedAt: null,
      },
    });
  }

  async updateUsersStatusByOrganization(
    organizationId: string,
    currentStatus: UserStatus,
    nextStatus: UserStatus,
    db: DatabaseClient = prisma,
  ): Promise<Prisma.BatchPayload> {
    return db.user.updateMany({
      where: {
        organizationId,
        status: currentStatus,
        deletedAt: null,
      },
      data: {
        status: nextStatus,
      },
    });
  }
}

export const organizationRepository = new OrganizationRepository();
