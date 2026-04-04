import { readFile } from "node:fs/promises";
import { experimental_transcribe as transcribe } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

class AiGateway {
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
}

export const aiGateway = new AiGateway();
