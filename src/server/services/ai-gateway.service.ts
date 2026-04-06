import { experimental_transcribe as transcribe, generateText } from "ai";
import { readFile } from "node:fs/promises";
import { createOpenAI } from "@ai-sdk/openai";

import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { aiStepBindingRepository } from "@/server/repositories/ai-step-binding.repository";
import type { AiStep, AiImplementationDTO } from "@/types/ai-config";

type AiModelConfig = {
  modelId: string | undefined;
  requiredEnvKeys: string[];
};

type ImplementationAvailability = {
  available: boolean;
  missingEnvKeys: string[];
};

type RegisteredImplementation = {
  key: string;
  name: string;
  supportedSteps: AiStep[];
  getModelConfig(step: AiStep): AiModelConfig;
  getAvailability(): ImplementationAvailability;
};

const arkImplementation: RegisteredImplementation = {
  key: "ark-default",
  name: "Ark Default",
  supportedSteps: ["TRANSCRIBE", "DECOMPOSE", "REWRITE"],
  getModelConfig(step) {
    switch (step) {
      case "TRANSCRIBE":
        return {
          modelId: env.ARK_TRANSCRIBE_MODEL,
          requiredEnvKeys: ["ARK_API_KEY", "ARK_BASE_URL", "ARK_TRANSCRIBE_MODEL"],
        };
      case "DECOMPOSE":
        return {
          modelId: env.ARK_DECOMPOSE_MODEL,
          requiredEnvKeys: ["ARK_API_KEY", "ARK_BASE_URL", "ARK_DECOMPOSE_MODEL"],
        };
      case "REWRITE":
      default:
        return {
          modelId: env.ARK_REWRITE_MODEL,
          requiredEnvKeys: ["ARK_API_KEY", "ARK_BASE_URL", "ARK_REWRITE_MODEL"],
        };
    }
  },
  getAvailability() {
    const requiredEnvKeys = new Set<string>();
    for (const step of this.supportedSteps) {
      for (const key of this.getModelConfig(step).requiredEnvKeys) {
        requiredEnvKeys.add(key);
      }
    }

    const missingEnvKeys = Array.from(requiredEnvKeys).filter((key) => {
      switch (key) {
        case "ARK_API_KEY":
          return !env.ARK_API_KEY;
        case "ARK_BASE_URL":
          return !env.ARK_BASE_URL;
        case "ARK_TRANSCRIBE_MODEL":
          return !env.ARK_TRANSCRIBE_MODEL;
        case "ARK_DECOMPOSE_MODEL":
          return !env.ARK_DECOMPOSE_MODEL;
        case "ARK_REWRITE_MODEL":
          return !env.ARK_REWRITE_MODEL;
        default:
          return true;
      }
    });

    return {
      available: missingEnvKeys.length === 0,
      missingEnvKeys,
    };
  },
};

const registry: Record<string, RegisteredImplementation> = {
  [arkImplementation.key]: arkImplementation,
};

class AiGatewayService {
  async transcribe(videoStoragePath: string, model: string): Promise<string> {
    const [providerId, ...modelParts] = model.split("/");
    const modelId = modelParts.join("/");

    if (providerId !== "openai" || !modelId) {
      throw new AppError("AI_MODEL_NOT_SUPPORTED", "暂不支持该转录模型提供方", 500);
    }

    if (!env.OPENAI_API_KEY) {
      throw new AppError("AI_NOT_CONFIGURED", "未配置 OPENAI_API_KEY", 500);
    }

    let fileData: Buffer;
    try {
      fileData = await readFile(videoStoragePath);
    } catch {
      throw new AppError("VIDEO_FILE_NOT_FOUND", "视频文件不存在", 500);
    }

    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
    });

    const result = await transcribe({
      model: openai.transcription(modelId),
      audio: fileData,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(120_000),
    });

    return result.text ?? "";
  }

  listImplementations(): AiImplementationDTO[] {
    return Object.values(registry).map((implementation) => {
      const availability = implementation.getAvailability();

      return {
        key: implementation.key,
        name: implementation.name,
        supportedSteps: implementation.supportedSteps,
        available: availability.available,
        missingEnvKeys: availability.missingEnvKeys,
      };
    });
  }

  async generateText(
    step: AiStep,
    prompt: string,
    implementationKey?: string,
  ): Promise<{
    implementationKey: string;
    modelId: string;
    text: string;
  }> {
    const binding = implementationKey
      ? { implementationKey }
      : await aiStepBindingRepository.findByStep(step);

    if (!binding?.implementationKey) {
      throw new AppError("AI_STEP_NOT_CONFIGURED", "AI 步骤尚未绑定可用实现", 409);
    }

    const implementation = registry[binding.implementationKey];
    if (!implementation) {
      throw new AppError("AI_IMPLEMENTATION_NOT_FOUND", "AI 实现不存在", 409);
    }

    const availability = implementation.getAvailability();
    if (!availability.available) {
      throw new AppError("AI_IMPLEMENTATION_UNAVAILABLE", "AI 实现当前不可用", 409);
    }

    const modelConfig = implementation.getModelConfig(step);
    if (!modelConfig.modelId) {
      throw new AppError("AI_MODEL_NOT_CONFIGURED", "AI 模型未配置", 409);
    }

    const modelClient = createOpenAI({
      apiKey: env.ARK_API_KEY,
      baseURL: env.ARK_BASE_URL,
    });

    const result = await generateText({
      model: modelClient(modelConfig.modelId),
      prompt,
    });

    return {
      implementationKey: implementation.key,
      modelId: modelConfig.modelId,
      text: result.text,
    };
  }
}

export const aiGateway = new AiGatewayService();
