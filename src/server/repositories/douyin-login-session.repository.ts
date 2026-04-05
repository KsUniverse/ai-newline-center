import {
  DouyinLoginSessionStatus,
  type DouyinLoginSession,
  type DouyinLoginSessionPurpose,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export interface CreateDouyinLoginSessionRecord {
  userId: string;
  organizationId: string;
  accountId?: string | null;
  purpose: DouyinLoginSessionPurpose;
  status?: DouyinLoginSessionStatus;
  expiresAt?: Date | null;
}

class DouyinLoginSessionRepository {
  async create(
    data: CreateDouyinLoginSessionRecord,
    db: DatabaseClient = prisma,
  ): Promise<DouyinLoginSession> {
    return db.douyinLoginSession.create({
      data,
    });
  }

  async findById(
    id: string,
    organizationId: string,
    db: DatabaseClient = prisma,
  ): Promise<DouyinLoginSession | null> {
    return db.douyinLoginSession.findFirst({
      where: {
        id,
        organizationId,
      },
    });
  }

  async findActiveByOwner(
    params: {
      userId: string;
      organizationId: string;
      accountId?: string | null;
      purpose?: DouyinLoginSessionPurpose;
    },
    db: DatabaseClient = prisma,
  ): Promise<DouyinLoginSession[]> {
    const { userId, organizationId, accountId, purpose } = params;

    return db.douyinLoginSession.findMany({
      where: {
        userId,
        organizationId,
        ...(accountId === undefined ? {} : { accountId }),
        ...(purpose ? { purpose } : {}),
        status: {
          in: [
            DouyinLoginSessionStatus.CREATED,
            DouyinLoginSessionStatus.QRCODE_READY,
            DouyinLoginSessionStatus.SCANNED,
            DouyinLoginSessionStatus.CONFIRMED,
          ],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async updateStatus(
    id: string,
    status: DouyinLoginSessionStatus,
    data: {
      qrcodeDataUrl?: string | null;
      expiresAt?: Date | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    } = {},
    db: DatabaseClient = prisma,
  ): Promise<DouyinLoginSession> {
    return db.douyinLoginSession.update({
      where: {
        id,
      },
      data: {
        status,
        ...data,
      },
    });
  }

  async updateQrcode(
    id: string,
    data: {
      qrcodeDataUrl: string | null;
      expiresAt: Date | null;
    },
    db: DatabaseClient = prisma,
  ): Promise<DouyinLoginSession> {
    return db.douyinLoginSession.update({
      where: {
        id,
      },
      data: {
        status: DouyinLoginSessionStatus.QRCODE_READY,
        qrcodeDataUrl: data.qrcodeDataUrl,
        expiresAt: data.expiresAt,
        errorCode: null,
        errorMessage: null,
        finishedAt: null,
      },
    });
  }

  async updateResolvedIdentity(
    id: string,
    data: {
      resolvedSecUserId?: string | null;
    },
    db: DatabaseClient = prisma,
  ): Promise<DouyinLoginSession> {
    return db.douyinLoginSession.update({
      where: {
        id,
      },
      data,
    });
  }

  async attachAccount(
    id: string,
    accountId: string,
    db: DatabaseClient = prisma,
  ): Promise<DouyinLoginSession> {
    return db.douyinLoginSession.update({
      where: {
        id,
      },
      data: {
        accountId,
      },
    });
  }

  async markFailed(
    id: string,
    errorCode: string,
    errorMessage: string,
    db: DatabaseClient = prisma,
  ): Promise<DouyinLoginSession> {
    return db.douyinLoginSession.update({
      where: {
        id,
      },
      data: {
        status: DouyinLoginSessionStatus.FAILED,
        errorCode,
        errorMessage,
        finishedAt: new Date(),
      },
    });
  }

  async markExpired(
    id: string,
    errorMessage: string = "二维码已失效，请刷新后重新扫码",
    db: DatabaseClient = prisma,
  ): Promise<DouyinLoginSession> {
    return db.douyinLoginSession.update({
      where: {
        id,
      },
      data: {
        status: DouyinLoginSessionStatus.EXPIRED,
        errorCode: "LOGIN_SESSION_EXPIRED",
        errorMessage,
        finishedAt: new Date(),
      },
    });
  }

  async markCancelled(
    id: string,
    db: DatabaseClient = prisma,
  ): Promise<DouyinLoginSession> {
    return db.douyinLoginSession.update({
      where: {
        id,
      },
      data: {
        status: DouyinLoginSessionStatus.CANCELLED,
        errorCode: null,
        errorMessage: null,
        finishedAt: new Date(),
      },
    });
  }

  async markSuccess(id: string, db: DatabaseClient = prisma): Promise<DouyinLoginSession> {
    return db.douyinLoginSession.update({
      where: {
        id,
      },
      data: {
        status: DouyinLoginSessionStatus.SUCCESS,
        errorCode: null,
        errorMessage: null,
        finishedAt: new Date(),
      },
    });
  }
}

export const douyinLoginSessionRepository = new DouyinLoginSessionRepository();
