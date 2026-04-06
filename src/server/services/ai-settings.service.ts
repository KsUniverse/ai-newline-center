import { UserRole } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { aiGateway } from "@/server/services/ai-gateway.service";
import { aiStepBindingRepository } from "@/server/repositories/ai-step-binding.repository";
import type { SessionUser } from "@/types/session";
import type { AiSettingsDTO, UpdateAiSettingsInput, AiStep } from "@/types/ai-config";

const aiSteps: AiStep[] = ["TRANSCRIBE", "DECOMPOSE", "REWRITE"];

class AiSettingsService {
  private assertSuperAdmin(caller: SessionUser): void {
    if (caller.role !== UserRole.SUPER_ADMIN) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }
  }

  async getSettings(caller: SessionUser): Promise<AiSettingsDTO> {
    this.assertSuperAdmin(caller);

    const [bindings, implementations] = await Promise.all([
      aiStepBindingRepository.findAll(),
      aiGateway.listImplementations(),
    ]);

    return {
      steps: aiSteps.map((step) => ({
        step,
        implementationKey: bindings.find((item) => item.step === step)?.implementationKey ?? null,
      })),
      bindings: aiSteps.map((step) => {
        const binding = bindings.find((item) => item.step === step);

        return {
          step,
          implementationKey: binding?.implementationKey ?? null,
        };
      }),
      implementations,
    };
  }

  async updateSettings(
    caller: SessionUser,
    input: UpdateAiSettingsInput,
  ): Promise<AiSettingsDTO> {
    this.assertSuperAdmin(caller);

    const implementations = aiGateway.listImplementations();
    const bindings = input.steps ?? input.bindings ?? [];

    for (const binding of bindings) {
      const implementation = implementations.find((item) => item.key === binding.implementationKey);
      if (!implementation) {
        throw new AppError("AI_IMPLEMENTATION_NOT_FOUND", "AI 实现不存在", 409);
      }

      if (!implementation.available) {
        throw new AppError("AI_IMPLEMENTATION_UNAVAILABLE", "AI 实现当前不可用", 409);
      }
    }

    await aiStepBindingRepository.replaceAll(bindings);
    return this.getSettings(caller);
  }
}

export const aiSettingsService = new AiSettingsService();
