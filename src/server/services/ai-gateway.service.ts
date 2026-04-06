import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

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

type EnvValueResolver = () => string | undefined;

type RestChatImplementation = {
  requestMode: "rest-chat";
  baseUrl: EnvValueResolver;
  apiKey: EnvValueResolver;
  modelId: EnvValueResolver;
  requiredEnvKeys: string[];
};

type OpenAiSdkImplementation = {
  requestMode: "openai-sdk";
  baseUrl: EnvValueResolver;
  apiKey: EnvValueResolver;
  modelId: EnvValueResolver;
  requiredEnvKeys: string[];
};

type RegisteredImplementationConfig = RestChatImplementation | OpenAiSdkImplementation;

type RegisteredImplementation = {
  key: string;
  name: string;
  provider: string;
  supportedSteps: AiStep[];
  getModelConfig(step: AiStep): AiModelConfig & RegisteredImplementationConfig;
  getAvailability(): ImplementationAvailability;
};

function resolveEnvValue(key: string): string | undefined {
  switch (key) {
    case "TRANSCRIBE_BASE_URL":
      return env.TRANSCRIBE_BASE_URL;
    case "TRANSCRIBE_API_KEY":
      return env.TRANSCRIBE_API_KEY;
    case "TRANSCRIBE_MODEL_NAME":
      return env.TRANSCRIBE_MODEL_NAME;
    case "ARK_API_KEY":
      return env.ARK_API_KEY;
    case "ARK_BASE_URL":
      return env.ARK_BASE_URL;
    case "ARK_TRANSCRIBE_MODEL":
      return env.ARK_TRANSCRIBE_MODEL;
    case "ARK_DECOMPOSE_MODEL":
      return env.ARK_DECOMPOSE_MODEL;
    case "ARK_REWRITE_MODEL":
      return env.ARK_REWRITE_MODEL;
    default:
      return undefined;
  }
}

function createSingleStepImplementation(config: {
  key: string;
  name: string;
  provider: string;
  step: AiStep;
  requestMode: RegisteredImplementationConfig["requestMode"];
  baseUrlEnvKey: string;
  apiKeyEnvKey: string;
  modelEnvKey: string;
}): RegisteredImplementation {
  return {
    key: config.key,
    name: config.name,
    provider: config.provider,
    supportedSteps: [config.step],
    getModelConfig() {
      return {
        requestMode: config.requestMode,
        baseUrl: () => resolveEnvValue(config.baseUrlEnvKey),
        apiKey: () => resolveEnvValue(config.apiKeyEnvKey),
        modelId: resolveEnvValue(config.modelEnvKey),
        requiredEnvKeys: [config.apiKeyEnvKey, config.baseUrlEnvKey, config.modelEnvKey],
      } as AiModelConfig & RegisteredImplementationConfig;
    },
    getAvailability() {
      const requiredEnvKeys = [config.apiKeyEnvKey, config.baseUrlEnvKey, config.modelEnvKey];
      const missingEnvKeys = requiredEnvKeys.filter((key) => !resolveEnvValue(key));

      return {
        available: missingEnvKeys.length === 0,
        missingEnvKeys,
      };
    },
  };
}

const volcengineTranscribeImplementation = createSingleStepImplementation({
  key: "volcengine-transcribe",
  name: "火山引擎转录",
  provider: "Volcengine Ark",
  step: "TRANSCRIBE",
  requestMode: "rest-chat",
  baseUrlEnvKey: "TRANSCRIBE_BASE_URL",
  apiKeyEnvKey: "TRANSCRIBE_API_KEY",
  modelEnvKey: "TRANSCRIBE_MODEL_NAME",
});

const arkTranscribeImplementation = createSingleStepImplementation({
  key: "ark-transcribe",
  name: "Ark 转录",
  provider: "Ark",
  step: "TRANSCRIBE",
  requestMode: "openai-sdk",
  baseUrlEnvKey: "ARK_BASE_URL",
  apiKeyEnvKey: "ARK_API_KEY",
  modelEnvKey: "ARK_TRANSCRIBE_MODEL",
});

const arkDecomposeImplementation = createSingleStepImplementation({
  key: "ark-decompose",
  name: "Ark 拆解",
  provider: "Ark",
  step: "DECOMPOSE",
  requestMode: "openai-sdk",
  baseUrlEnvKey: "ARK_BASE_URL",
  apiKeyEnvKey: "ARK_API_KEY",
  modelEnvKey: "ARK_DECOMPOSE_MODEL",
});

const arkRewriteImplementation = createSingleStepImplementation({
  key: "ark-rewrite",
  name: "Ark 仿写",
  provider: "Ark",
  step: "REWRITE",
  requestMode: "openai-sdk",
  baseUrlEnvKey: "ARK_BASE_URL",
  apiKeyEnvKey: "ARK_API_KEY",
  modelEnvKey: "ARK_REWRITE_MODEL",
});

const registry: Record<string, RegisteredImplementation> = {
  [volcengineTranscribeImplementation.key]: volcengineTranscribeImplementation,
  [arkTranscribeImplementation.key]: arkTranscribeImplementation,
  [arkDecomposeImplementation.key]: arkDecomposeImplementation,
  [arkRewriteImplementation.key]: arkRewriteImplementation,
};

function buildRestChatPayload(modelId: string, prompt: string) {
  return {
    model: modelId,
    messages: [{ role: "user", content: prompt }],
    thinking: {
      type: "disabled",
    },
  };
}

class AiGatewayService {
  listImplementations(): AiImplementationDTO[] {
    return Object.values(registry).map((implementation) => {
      const availability = implementation.getAvailability();
      const primaryStep = implementation.supportedSteps[0];
      if (!primaryStep) {
        throw new AppError("AI_IMPLEMENTATION_INVALID", "AI 实现未声明可用步骤", 500);
      }

      return {
        key: implementation.key,
        name: implementation.name,
        provider: implementation.provider,
        supportedSteps: implementation.supportedSteps,
        available: availability.available,
        missingEnvKeys: availability.missingEnvKeys,
        requiredEnvKeys: implementation.getModelConfig(primaryStep).requiredEnvKeys,
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

    const baseUrl = modelConfig.baseUrl();
    const apiKey = modelConfig.apiKey();
    if (!baseUrl || !apiKey) {
      throw new AppError("AI_IMPLEMENTATION_UNAVAILABLE", "AI 实现当前不可用", 409);
    }

    let text: string;

    if (modelConfig.requestMode === "rest-chat") {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(buildRestChatPayload(modelConfig.modelId, prompt)),
      });

      if (!response.ok) {
        throw new AppError("AI_REQUEST_FAILED", `AI 请求失败: ${response.status}`, 502);
      }

      const payload = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };
      text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    } else {
      const modelClient = createOpenAI({
        apiKey,
        baseURL: baseUrl,
      });

      const result = await generateText({
        model: modelClient(modelConfig.modelId),
        prompt,
      });
      text = result.text;
    }

    if (!text) {
      throw new AppError("AI_EMPTY_RESPONSE", "AI 未返回有效内容", 502);
    }

    return {
      implementationKey: implementation.key,
      modelId: modelConfig.modelId,
      text,
    };
  }
}

export const aiGateway = new AiGatewayService();
