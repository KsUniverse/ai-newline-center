import type { AiModelConfig, Prisma, PrismaClient, PromptTemplate } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  CreatePromptTemplateInput,
  ListPromptTemplatesParams,
  PromptTemplateDTO,
  PromptStepType,
  UpdatePromptTemplateInput,
} from "@/types/prompt-template";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type PromptTemplateWithConfig = PromptTemplate & {
  modelConfig: Pick<AiModelConfig, "id" | "name"> | null;
};

function toDTO(record: PromptTemplateWithConfig): PromptTemplateDTO {
  return {
    id: record.id,
    name: record.name,
    stepType: record.stepType,
    systemContent: record.systemContent,
    content: record.content,
    modelConfigId: record.modelConfigId,
    modelConfigName: record.modelConfig?.name ?? null,
    isDefault: record.isDefault,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

const modelConfigSelect = { select: { id: true, name: true } } as const;

class PromptTemplateRepository {
  async findAll(
    params: ListPromptTemplatesParams = {},
    db: DatabaseClient = prisma,
  ): Promise<PromptTemplateDTO[]> {
    const where: Prisma.PromptTemplateWhereInput = {};
    if (params.stepType !== undefined) {
      where.stepType = params.stepType;
    }
    if (params.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    const records = await db.promptTemplate.findMany({
      where,
      include: { modelConfig: modelConfigSelect },
      orderBy: { createdAt: "desc" },
    });

    return records.map(toDTO);
  }

  async findById(id: string, db: DatabaseClient = prisma): Promise<PromptTemplateDTO | null> {
    const record = await db.promptTemplate.findUnique({
      where: { id },
      include: { modelConfig: modelConfigSelect },
    });

    return record ? toDTO(record) : null;
  }

  async findDefault(
    stepType: PromptStepType,
    db: DatabaseClient = prisma,
  ): Promise<PromptTemplate | null> {
    return db.promptTemplate.findFirst({
      where: { stepType, isDefault: true, isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async createAsDefault(input: CreatePromptTemplateInput): Promise<PromptTemplateDTO> {
    const run = async (tx: Prisma.TransactionClient): Promise<PromptTemplateWithConfig> => {
      await tx.promptTemplate.updateMany({
        where: { stepType: input.stepType },
        data: { isDefault: false },
      });
      return tx.promptTemplate.create({
        data: {
          name: input.name,
          stepType: input.stepType,
          systemContent: input.systemContent ?? null,
          content: input.content,
          modelConfigId: input.modelConfigId ?? null,
          isDefault: true,
          isActive: input.isActive ?? true,
        },
        include: { modelConfig: modelConfigSelect },
      });
    };

    const record = await (prisma as PrismaClient).$transaction(run);
    return toDTO(record);
  }

  async updateAsDefault(
    id: string,
    stepType: PromptStepType,
    input: UpdatePromptTemplateInput,
  ): Promise<PromptTemplateDTO> {
    const run = async (tx: Prisma.TransactionClient): Promise<PromptTemplateWithConfig> => {
      await tx.promptTemplate.updateMany({
        where: { stepType },
        data: { isDefault: false },
      });
      const data: Prisma.PromptTemplateUncheckedUpdateInput = { isDefault: true };
      if (input.name !== undefined) data.name = input.name;
      if ("systemContent" in input) data.systemContent = input.systemContent;
      if (input.content !== undefined) data.content = input.content;
      if ("modelConfigId" in input) data.modelConfigId = input.modelConfigId;
      if (input.isActive !== undefined) data.isActive = input.isActive;
      return tx.promptTemplate.update({
        where: { id },
        data,
        include: { modelConfig: modelConfigSelect },
      });
    };

    const record = await (prisma as PrismaClient).$transaction(run);
    return toDTO(record);
  }

  async create(
    input: CreatePromptTemplateInput,
    db: DatabaseClient = prisma,
  ): Promise<PromptTemplateDTO> {
    const record = await db.promptTemplate.create({
      data: {
        name: input.name,
        stepType: input.stepType,
        systemContent: input.systemContent ?? null,
        content: input.content,
        modelConfigId: input.modelConfigId ?? null,
        isDefault: input.isDefault ?? false,
        isActive: input.isActive ?? true,
      },
      include: { modelConfig: modelConfigSelect },
    });

    return toDTO(record);
  }

  async update(
    id: string,
    input: UpdatePromptTemplateInput,
    db: DatabaseClient = prisma,
  ): Promise<PromptTemplateDTO | null> {
    const existing = await db.promptTemplate.findUnique({ where: { id } });
    if (!existing) return null;

    const data: Prisma.PromptTemplateUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if ("systemContent" in input) data.systemContent = input.systemContent;
    if (input.content !== undefined) data.content = input.content;
    if ("modelConfigId" in input) data.modelConfigId = input.modelConfigId;
    if (input.isDefault !== undefined) data.isDefault = input.isDefault;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const record = await db.promptTemplate.update({
      where: { id },
      data,
      include: { modelConfig: modelConfigSelect },
    });

    return toDTO(record);
  }

  async setDefault(
    id: string,
    stepType: PromptStepType,
    db: DatabaseClient = prisma,
  ): Promise<void> {
    const run = async (tx: Prisma.TransactionClient): Promise<void> => {
      await tx.promptTemplate.updateMany({
        where: { stepType },
        data: { isDefault: false },
      });
      await tx.promptTemplate.update({
        where: { id },
        data: { isDefault: true },
      });
    };

    if ("$transaction" in db) {
      await (db as PrismaClient).$transaction(run);
    } else {
      await run(db as Prisma.TransactionClient);
    }
  }

  async delete(id: string, db: DatabaseClient = prisma): Promise<boolean> {
    const existing = await db.promptTemplate.findUnique({ where: { id } });
    if (!existing) return false;

    await db.promptTemplate.delete({ where: { id } });
    return true;
  }
}

export const promptTemplateRepository = new PromptTemplateRepository();
