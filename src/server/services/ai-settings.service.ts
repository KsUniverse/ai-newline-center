import { UserRole } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { aiModelConfigRepository } from "@/server/repositories/ai-model-config.repository";
import { aiStepBindingRepository } from "@/server/repositories/ai-step-binding.repository";
import type { SessionUser } from "@/types/session";
import type {
  AiSettingsDTO,
  AiStepBindingDTO,
  UpdateAiSettingsInput,
  AiStep,
} from "@/types/ai-config";

const AI_STEPS: AiStep[] = ["TRANSCRIBE", "DECOMPOSE", "REWRITE"];

class AiSettingsService {
  private assertSuperAdmin(caller: SessionUser): void {
    if (caller.role !== UserRole.SUPER_ADMIN) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }
  }

  async getSettings(caller: SessionUser): Promise<AiSettingsDTO> {
    this.assertSuperAdmin(caller);

    const [bindings, modelConfigs] = await Promise.all([
      aiStepBindingRepository.findAll(),
      aiModelConfigRepository.findAll(),
    ]);

    const configMap = new Map(modelConfigs.map((c) => [c.id, c]));

    const bindingDTOs: AiStepBindingDTO[] = AI_STEPS.map((step) => {
      const binding = bindings.find((b) => b.step === step);
      const modelConfigId = binding?.modelConfigId ?? null;
      return {
        step,
        modelConfigId,
        modelConfig: modelConfigId ? (configMap.get(modelConfigId) ?? null) : null,
      };
    });

    return { bindings: bindingDTOs, modelConfigs };
  }

  async getSettingsReadOnly(): Promise<AiSettingsDTO> {
    const [bindings, modelConfigs] = await Promise.all([
      aiStepBindingRepository.findAll(),
      aiModelConfigRepository.findAll(),
    ]);

    const configMap = new Map(modelConfigs.map((c) => [c.id, c]));

    const bindingDTOs: AiStepBindingDTO[] = AI_STEPS.map((step) => {
      const binding = bindings.find((b) => b.step === step);
      const modelConfigId = binding?.modelConfigId ?? null;
      return {
        step,
        modelConfigId,
        modelConfig: modelConfigId ? (configMap.get(modelConfigId) ?? null) : null,
      };
    });

    return { bindings: bindingDTOs, modelConfigs };
  }

  async updateSettings(
    caller: SessionUser,
    input: UpdateAiSettingsInput,
  ): Promise<AiSettingsDTO> {
    this.assertSuperAdmin(caller);

    const modelConfigs = await aiModelConfigRepository.findAll();
    const configIds = new Set(modelConfigs.map((c) => c.id));

    // Normalize: ensure all 3 steps are present
    const bindingMap = new Map(input.bindings.map((b) => [b.step, b.modelConfigId]));
    const normalizedBindings = AI_STEPS.map((step) => ({
      step,
      modelConfigId: bindingMap.get(step) ?? null,
    }));

    for (const binding of normalizedBindings) {
      if (!binding.modelConfigId) continue;
      if (!configIds.has(binding.modelConfigId)) {
        throw new AppError("AI_MODEL_NOT_FOUND", "绑定的模型配置不存在", 409);
      }
    }

    await aiStepBindingRepository.replaceAll(normalizedBindings);
    return this.getSettings(caller);
  }
}

export const aiSettingsService = new AiSettingsService();
