import type { Prisma, PrismaClient, Rewrite, RewriteVersion } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { RewriteDTO, RewriteVersionDTO } from "@/types/ai-workspace";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type RewriteWithVersions = Prisma.RewriteGetPayload<{
  include: {
    versions: {
      orderBy: { versionNumber: "desc" };
      include: { modelConfig: { select: { id: true; name: true } } };
    };
    targetAccount: {
      select: { id: true; nickname: true; avatar: true; signature: true };
    };
  };
}>;

export interface UpsertRewriteData {
  workspaceId: string;
  targetAccountId: string;
  organizationId: string;
  userId: string;
}

export interface CreateRewriteVersionData {
  rewriteId: string;
  versionNumber: number;
  modelConfigId: string;
  usedFragmentIds: string[];
  userInputContent?: string;
}

function versionToDTO(
  v: Prisma.RewriteVersionGetPayload<{
    include: { modelConfig: { select: { id: true; name: true } } };
  }>,
): RewriteVersionDTO {
  return {
    id: v.id,
    rewriteId: v.rewriteId,
    versionNumber: v.versionNumber,
    generatedContent: v.generatedContent ?? null,
    editedContent: v.editedContent ?? null,
    usedFragmentIds: (v.usedFragmentIds as string[]) ?? [],
    userInputContent: v.userInputContent ?? null,
    status: v.status as RewriteVersionDTO["status"],
    errorMessage: v.errorMessage ?? null,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    modelConfig: v.modelConfig
      ? { id: v.modelConfig.id, name: v.modelConfig.name }
      : null,
  };
}

function rewriteToDTO(r: RewriteWithVersions): RewriteDTO {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    targetAccountId: r.targetAccountId ?? null,
    organizationId: r.organizationId,
    userId: r.userId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    targetAccount: r.targetAccount
      ? {
          id: r.targetAccount.id,
          nickname: r.targetAccount.nickname,
          avatar: r.targetAccount.avatar,
          signature: r.targetAccount.signature ?? null,
        }
      : null,
    versions: r.versions.map(versionToDTO),
  };
}

class RewriteRepository {
  async findByWorkspaceId(
    workspaceId: string,
    db: DatabaseClient = prisma,
  ): Promise<RewriteDTO | null> {
    const record = await db.rewrite.findUnique({
      where: { workspaceId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          include: { modelConfig: { select: { id: true, name: true } } },
        },
        targetAccount: {
          select: { id: true, nickname: true, avatar: true, signature: true },
        },
      },
    });
    return record ? rewriteToDTO(record) : null;
  }

  async upsertByWorkspace(
    data: UpsertRewriteData,
    db: DatabaseClient = prisma,
  ): Promise<Rewrite> {
    return db.rewrite.upsert({
      where: { workspaceId: data.workspaceId },
      create: {
        workspaceId: data.workspaceId,
        targetAccountId: data.targetAccountId,
        organizationId: data.organizationId,
        userId: data.userId,
      },
      update: { targetAccountId: data.targetAccountId },
    });
  }

  async createVersion(
    data: CreateRewriteVersionData,
    db: DatabaseClient = prisma,
  ): Promise<RewriteVersion> {
    return db.rewriteVersion.create({
      data: {
        rewriteId: data.rewriteId,
        versionNumber: data.versionNumber,
        modelConfigId: data.modelConfigId,
        usedFragmentIds: data.usedFragmentIds,
        userInputContent: data.userInputContent ?? null,
        status: "GENERATING",
      },
    });
  }

  async findVersionById(
    versionId: string,
    db: DatabaseClient = prisma,
  ): Promise<Prisma.RewriteVersionGetPayload<{ include: { rewrite: { select: { workspaceId: true } } } }> | null> {
    return db.rewriteVersion.findUnique({
      where: { id: versionId },
      include: { rewrite: { select: { workspaceId: true } } },
    });
  }

  async updateVersionContent(
    versionId: string,
    editedContent: string,
    db: DatabaseClient = prisma,
  ): Promise<RewriteVersion> {
    return db.rewriteVersion.update({
      where: { id: versionId },
      data: { editedContent },
    });
  }

  async markVersionCompleted(
    versionId: string,
    generatedContent: string,
    db: DatabaseClient = prisma,
  ): Promise<void> {
    await db.rewriteVersion.update({
      where: { id: versionId },
      data: { generatedContent, status: "COMPLETED" },
    });
  }

  async markVersionFailed(
    versionId: string,
    errorMessage: string,
    db: DatabaseClient = prisma,
  ): Promise<void> {
    await db.rewriteVersion.update({
      where: { id: versionId },
      data: { status: "FAILED", errorMessage },
    });
  }
}

export const rewriteRepository = new RewriteRepository();
