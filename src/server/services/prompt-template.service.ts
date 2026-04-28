import type { PromptTemplate } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { promptTemplateRepository } from "@/server/repositories/prompt-template.repository";
import type {
  CreatePromptTemplateInput,
  ListPromptTemplatesParams,
  PromptTemplateDTO,
  PromptStepType,
  UpdatePromptTemplateInput,
} from "@/types/prompt-template";

class PromptTemplateService {
  async list(params: ListPromptTemplatesParams = {}): Promise<PromptTemplateDTO[]> {
    return promptTemplateRepository.findAll(params);
  }

  async getById(id: string): Promise<PromptTemplateDTO> {
    const record = await promptTemplateRepository.findById(id);
    if (!record) {
      throw new AppError("NOT_FOUND", "模板不存在", 404);
    }
    return record;
  }

  async create(input: CreatePromptTemplateInput): Promise<PromptTemplateDTO> {
    if (input.isDefault === true) {
      // Atomic: create + setDefault in one transaction via repository
      const created = await promptTemplateRepository.createAsDefault(input);
      return created;
    }
    return promptTemplateRepository.create({ ...input, isDefault: false });
  }

  async update(id: string, input: UpdatePromptTemplateInput): Promise<PromptTemplateDTO> {
    const existing = await promptTemplateRepository.findById(id);
    if (!existing) {
      throw new AppError("NOT_FOUND", "模板不存在", 404);
    }

    if (input.isDefault === false && existing.isDefault === true) {
      throw new AppError(
        "PROMPT_TEMPLATE_CANNOT_UNSET_DEFAULT",
        "不能直接取消默认，请将其他模板设为默认",
        400,
      );
    }

    if (input.isDefault === true) {
      // Atomic: setDefault + update other fields in one transaction
      return promptTemplateRepository.updateAsDefault(id, existing.stepType, input);
    }

    const updated = await promptTemplateRepository.update(id, input);
    if (!updated) {
      throw new AppError("NOT_FOUND", "模板不存在", 404);
    }
    return updated;
  }

  async setDefault(id: string): Promise<PromptTemplateDTO> {
    const existing = await promptTemplateRepository.findById(id);
    if (!existing) {
      throw new AppError("NOT_FOUND", "模板不存在", 404);
    }

    await promptTemplateRepository.setDefault(id, existing.stepType);

    const result = await promptTemplateRepository.findById(id);
    if (!result) {
      throw new AppError("NOT_FOUND", "模板不存在", 404);
    }
    return result;
  }

  async delete(id: string): Promise<void> {
    const existing = await promptTemplateRepository.findById(id);
    if (!existing) {
      throw new AppError("NOT_FOUND", "模板不存在", 404);
    }

    if (existing.isDefault) {
      throw new AppError(
        "PROMPT_TEMPLATE_IS_DEFAULT",
        "请先将其他模板设为默认后再删除",
        400,
      );
    }

    await promptTemplateRepository.delete(id);
  }

  async getDefaultTemplate(stepType: PromptStepType): Promise<PromptTemplate | null> {
    try {
      return await promptTemplateRepository.findDefault(stepType);
    } catch (error) {
      console.warn("[PromptTemplateService] Failed to fetch default template", {
        stepType,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }
}

export const promptTemplateService = new PromptTemplateService();
