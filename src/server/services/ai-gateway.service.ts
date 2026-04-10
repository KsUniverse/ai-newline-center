import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { FileState, GoogleAIFileManager } from "@google/generative-ai/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { AppError } from "@/lib/errors";
import { aiModelConfigRepository } from "@/server/repositories/ai-model-config.repository";
import { aiStepBindingRepository } from "@/server/repositories/ai-step-binding.repository";
import type { AiModelConfig } from "@prisma/client";
import type { AiStep } from "@/types/ai-config";

// ─── 提示词 ───────────────────────────────────────────────────────────────────

function buildVideoTranscriptionPrompt(): string {
  return [
    "你是一名短视频文案转录助手。",
    "请直接观看这段视频，输出一份适合后续人工校对的中文转录正文。",
    "要求：",
    "1. 只输出转录正文本身，不要添加标题、说明、总结、标签或额外注释。",
    "2. 保持中文自然断句和标点，便于直接作为文稿初稿使用。",
    "3. 若存在口语语气词，可按不改变原意的原则做轻量整理。",
    "4. 不要编造视频中不存在的内容。",
  ].join("\n");
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function resolveVideoMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp4": return "video/mp4";
    case ".mov": return "video/quicktime";
    case ".webm": return "video/webm";
    case ".m4v": return "video/x-m4v";
    case ".avi": return "video/x-msvideo";
    case ".mkv": return "video/x-matroska";
    default: return "video/mp4";
  }
}

async function resolveModelConfig(step: AiStep, modelConfigId?: string): Promise<AiModelConfig> {
  if (modelConfigId) {
    const config = await aiModelConfigRepository.findByIdRaw(modelConfigId);
    if (!config) throw new AppError("AI_MODEL_NOT_FOUND", "指定的 AI 模型配置不存在", 409);
    return config;
  }

  const binding = await aiStepBindingRepository.findByStep(step);
  if (!binding?.modelConfigId) {
    throw new AppError("AI_STEP_NOT_CONFIGURED", "AI 步骤尚未绑定模型配置", 409);
  }

  const config = await aiModelConfigRepository.findByIdRaw(binding.modelConfigId);
  if (!config) throw new AppError("AI_MODEL_NOT_FOUND", "步骤绑定的模型配置不存在", 409);
  return config;
}

// ─── 转录实现 — Google AI Studio (文件上传) ───────────────────────────────────

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  baseDelayMs = 2000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable =
        /\b5\d{2}\b/.test(msg) ||
        /failed to convert server response to json/i.test(msg);
      if (!isRetryable || attempt === maxRetries) throw err;
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

async function uploadVideoFileToGoogle(
  fileManager: GoogleAIFileManager,
  localFilePath: string,
): Promise<string> {
  const displayName = path.basename(localFilePath);
  const MAX_UPLOAD_ATTEMPTS = 2;

  for (let uploadAttempt = 1; uploadAttempt <= MAX_UPLOAD_ATTEMPTS; uploadAttempt++) {
    let uploadedFileName: string | undefined;
    try {
      console.log(`[GoogleTranscribe] Uploading ${displayName}, attempt ${uploadAttempt}...`);
      const uploadResult = await retryWithBackoff(() =>
        fileManager.uploadFile(localFilePath, {
          mimeType: resolveVideoMimeType(localFilePath),
          displayName,
        }),
      );
      uploadedFileName = uploadResult.file.name;

      await new Promise((resolve) => setTimeout(resolve, 3000));

      let file = await retryWithBackoff(() => fileManager.getFile(uploadedFileName!));
      while (file.state === FileState.PROCESSING) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        file = await retryWithBackoff(() => fileManager.getFile(uploadedFileName!));
      }

      if (file.state === FileState.FAILED) {
        throw new AppError("AI_REQUEST_FAILED", "Google AI 视频文件处理失败", 502);
      }

      console.log(`[GoogleTranscribe] File ready: ${file.uri}`);
      return file.uri;
    } catch (err) {
      if (uploadedFileName) {
        try { await fileManager.deleteFile(uploadedFileName); } catch { /* ignore */ }
      }
      if (uploadAttempt === MAX_UPLOAD_ATTEMPTS) {
        throw err instanceof AppError ? err : new AppError("AI_REQUEST_FAILED", "Google AI 文件上传失败", 502);
      }
      console.warn(`[GoogleTranscribe] Upload attempt ${uploadAttempt} failed, retrying in 10s...`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
  throw new AppError("AI_REQUEST_FAILED", "Google AI 文件上传失败", 502);
}

async function transcribeWithGoogleFile(
  config: AiModelConfig,
  videoInput: string,
): Promise<string> {
  const fileManager = new GoogleAIFileManager(config.apiKey);
  const genAI = new GoogleGenerativeAI(config.apiKey);

  // If videoInput is an HTTPS URL, download to a temp file first
  let localFilePath: string;
  let tempFile: string | null = null;
  if (videoInput.startsWith("http://") || videoInput.startsWith("https://")) {
    const ext = path.extname(new URL(videoInput).pathname) || ".mp4";
    tempFile = path.join(os.tmpdir(), `google-transcription-${Date.now()}${ext}`);
    const resp = await fetch(videoInput, { signal: AbortSignal.timeout(120_000) });
    if (!resp.ok) {
      throw new AppError("AI_REQUEST_FAILED", `视频下载失败: ${resp.status} ${videoInput}`, 502);
    }
    await writeFile(tempFile, Buffer.from(await resp.arrayBuffer()));
    localFilePath = tempFile;
  } else {
    localFilePath = videoInput;
  }

  try {
    const fileUri = await uploadVideoFileToGoogle(fileManager, localFilePath);
    const mimeType = resolveVideoMimeType(localFilePath);

    const model = genAI.getGenerativeModel({
      model: config.modelName,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    });

    const result = await retryWithBackoff(() =>
      model.generateContent({
        contents: [{
          role: "user",
          parts: [
            { fileData: { mimeType, fileUri } },
            { text: buildVideoTranscriptionPrompt() },
          ],
        }],
      }),
    );

    const text = result.response.text().trim();
    if (!text) throw new AppError("AI_EMPTY_RESPONSE", "AI 未返回有效内容", 502);
    return text;
  } finally {
    if (tempFile) await rm(tempFile, { force: true }).catch(() => undefined);
  }
}

// ─── 转录实现 — OSS 直链（千问 VL，直接传 HTTPS URL） ─────────────────────────

async function transcribeWithOssUrl(
  config: AiModelConfig,
  videoUrl: string,
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/chat\/completions\/?$/, "");
  const chatResp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.modelName,
      // stream: true,
      messages: [
        {
          role: "user",
          content: [
            { type: "video_url", video_url: { url: videoUrl } },
            { type: "text", text: buildVideoTranscriptionPrompt() },
          ],
        },
      ],
    }),
  });

  if (!chatResp.ok) {
    const body = await chatResp.text().catch(() => "");
    throw new AppError("AI_REQUEST_FAILED", `DashScope 视频转录请求失败: ${body}`, 502);
  }

  const chatData = (await chatResp.json()) as {
    choices: Array<{ message: { content: string | null } }>;
  };

  const text = chatData.choices[0]?.message?.content?.trim() ?? "";
  if (!text) throw new AppError("AI_EMPTY_RESPONSE", "AI 未返回有效内容", 502);
  return text;
}

// ─── 文本生成实现（DECOMPOSE / REWRITE） ─────────────────────────────────────

async function generateTextWithConfig(
  config: AiModelConfig,
  prompt: string,
): Promise<string> {
  const modelClient = createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
  const result = await generateText({
    model: modelClient(config.modelName),
    prompt,
  });
  const text = result.text.trim();
  if (!text) throw new AppError("AI_EMPTY_RESPONSE", "AI 未返回有效内容", 502);
  return text;
}

// ─── AiGatewayService ─────────────────────────────────────────────────────────

interface GenerateRewriteParams {
  modelConfig: AiModelConfig;
  systemPrompt: string;
  userPrompt: string;
}

interface GenerateRewriteResult {
  text: string;
  modelConfigId: string;
}

class AiGatewayService {
  async generateTranscriptionFromVideo(
    videoInput: string,
    modelConfigId?: string,
  ): Promise<{ modelConfigId: string; modelName: string; text: string }> {
    const config = await resolveModelConfig("TRANSCRIBE", modelConfigId);

    if (config.videoInputMode === "NONE") {
      throw new AppError(
        "AI_MODEL_NO_VIDEO_SUPPORT",
        "该模型不支持视频输入，请在 AI 配置中选择支持视频转录的模型",
        409,
      );
    }

    let text: string;
    if (config.videoInputMode === "GOOGLE_FILE") {
      text = await transcribeWithGoogleFile(config, videoInput);
    } else {
      // OSS_FILE: pass the HTTPS URL directly to the model
      text = await transcribeWithOssUrl(config, videoInput);
    }

    return { modelConfigId: config.id, modelName: config.modelName, text };
  }

  async generateText(
    step: AiStep,
    prompt: string,
    modelConfigId?: string,
  ): Promise<{ modelConfigId: string; modelName: string; text: string }> {
    if (step === "TRANSCRIBE") {
      throw new AppError(
        "AI_TRANSCRIBE_INPUT_MISMATCH",
        "转录步骤需通过视频文件入口发起，不能走纯文本入口",
        409,
      );
    }

    const config = await resolveModelConfig(step, modelConfigId);
    const text = await generateTextWithConfig(config, prompt);
    return { modelConfigId: config.id, modelName: config.modelName, text };
  }

  async generateRewrite(params: GenerateRewriteParams): Promise<GenerateRewriteResult> {
    const { modelConfig, systemPrompt, userPrompt } = params;
    const modelClient = createOpenAI({
      apiKey: modelConfig.apiKey,
      baseURL: modelConfig.baseUrl,
    });
    const result = await generateText({
      model: modelClient(modelConfig.modelName),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      abortSignal: AbortSignal.timeout(120_000),
    });
    const text = result.text.trim();
    if (!text) throw new AppError("AI_EMPTY_RESPONSE", "AI 未返回有效内容", 502);
    return { text, modelConfigId: modelConfig.id };
  }
}

export const aiGateway = new AiGatewayService();

