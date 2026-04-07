import type { AiModelConfig, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { AiModelConfigDTO, CreateAiModelConfigInput, UpdateAiModelConfigInput } from "@/types/ai-config";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 4) return "****";
  return `${"*".repeat(Math.max(4, apiKey.length - 4))}${apiKey.slice(-4)}`;
}

function toDTO(record: AiModelConfig): AiModelConfigDTO {
  return {
    id: record.id,
    name: record.name,
    baseUrl: record.baseUrl,
    apiKeyMasked: maskApiKey(record.apiKey),
    modelName: record.modelName,
    videoInputMode: record.videoInputMode as AiModelConfigDTO["videoInputMode"],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

class AiModelConfigRepository {
  async findAll(db: DatabaseClient = prisma): Promise<AiModelConfigDTO[]> {
    const records = await db.aiModelConfig.findMany({
      orderBy: { createdAt: "asc" },
    });
    return records.map(toDTO);
  }

  async findById(id: string, db: DatabaseClient = prisma): Promise<AiModelConfigDTO | null> {
    const record = await db.aiModelConfig.findUnique({ where: { id } });
    return record ? toDTO(record) : null;
  }

  /** 读取原始记录（含未脱敏 apiKey），仅供网关内部使用 */
  async findByIdRaw(id: string, db: DatabaseClient = prisma): Promise<AiModelConfig | null> {
    return db.aiModelConfig.findUnique({ where: { id } });
  }

  async create(input: CreateAiModelConfigInput, db: DatabaseClient = prisma): Promise<AiModelConfigDTO> {
    const record = await db.aiModelConfig.create({
      data: {
        name: input.name,
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
        modelName: input.modelName,
        videoInputMode: input.videoInputMode,
      },
    });
    return toDTO(record);
  }

  async update(
    id: string,
    input: UpdateAiModelConfigInput,
    db: DatabaseClient = prisma,
  ): Promise<AiModelConfigDTO | null> {
    const existing = await db.aiModelConfig.findUnique({ where: { id } });
    if (!existing) return null;

    const record = await db.aiModelConfig.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.baseUrl !== undefined && { baseUrl: input.baseUrl }),
        ...(input.apiKey ? { apiKey: input.apiKey } : {}),
        ...(input.modelName !== undefined && { modelName: input.modelName }),
        ...(input.videoInputMode !== undefined && { videoInputMode: input.videoInputMode }),
      },
    });
    return toDTO(record);
  }

  async delete(id: string, db: DatabaseClient = prisma): Promise<boolean> {
    const existing = await db.aiModelConfig.findUnique({ where: { id } });
    if (!existing) return false;
    await db.aiModelConfig.delete({ where: { id } });
    return true;
  }
}

export const aiModelConfigRepository = new AiModelConfigRepository();
