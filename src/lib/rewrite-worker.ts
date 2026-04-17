import { Worker } from "bullmq";

import { REWRITE_QUEUE_NAME, type RewriteJobData } from "@/lib/bullmq";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createBullMQRedisConnection } from "@/lib/redis";
import { rewriteRepository } from "@/server/repositories/rewrite.repository";
import { aiGateway } from "@/server/services/ai-gateway.service";
import type { AiDecompositionAnnotation } from "@prisma/client";

declare global {
  var __rewriteWorkerInitialized: boolean | undefined;
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

interface BuildRewritePromptParams {
  targetAccountNickname: string;
  targetAccountSignature: string | null;
  annotations: AiDecompositionAnnotation[];
  transcriptText: string;
  fragments: Array<{ content: string }>;
  userInputContent: string | null;
}

function buildRewriteSystemPrompt(): string {
  return "你是一位短视频文案创作专家，擅长基于对标视频的内容框架，结合观点素材，创作适合特定账号风格的短视频文案。";
}

function buildRewriteUserPrompt(params: BuildRewritePromptParams): string {
  const {
    targetAccountNickname,
    targetAccountSignature,
    annotations,
    transcriptText,
    fragments,
    userInputContent,
  } = params;

  const annotationsText = annotations
    .map((a) => `• "${a.quotedText}"：${a.note ?? a.function ?? "（无说明）"}`)
    .join("\n");

  const fragmentsText =
    fragments.length > 0
      ? fragments.map((f) => `• ${f.content}`).join("\n")
      : "（未选择观点，请基于框架结构自由创作）";

  const userInputSection =
    userInputContent?.trim()
      ? `\n【创作者补充的临时素材】\n${userInputContent.trim()}`
      : "";

  return [
    `【目标账号风格】`,
    `账号名称：${targetAccountNickname}`,
    `账号简介：${targetAccountSignature ?? "暂无"}`,
    ``,
    `【对标视频拆解框架】`,
    `以下是对标视频的拆解批注，每条批注说明了原文对应的写作手法或内容角色：`,
    annotationsText,
    ``,
    `【对标视频原文案】`,
    transcriptText,
    ``,
    `【本次仿写使用的观点素材】`,
    fragmentsText,
    userInputSection,
    ``,
    `【创作要求】`,
    `请基于以上对标视频的框架结构，融入上述观点素材，为「${targetAccountNickname}」这个账号创作一篇新的短视频文案。`,
    `要求：`,
    `1. 遵循对标视频的整体结构节奏，但内容不能重复原文`,
    `2. 将观点素材自然融入对应的框架位置`,
    `3. 语言风格贴合账号定位`,
    `4. 直接输出文案正文，不需要解释或说明`,
  ]
    .join("\n")
    .trimEnd();
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export function startRewriteWorker(): void {
  if (globalThis.__rewriteWorkerInitialized) {
    console.log("[RewriteWorker] already started, skipping", { pid: process.pid });
    return;
  }

  if (!env.REDIS_URL) {
    console.warn("[RewriteWorker] REDIS_URL not set, worker skipped.");
    return;
  }

  globalThis.__rewriteWorkerInitialized = true;

  const worker = new Worker<RewriteJobData>(
    REWRITE_QUEUE_NAME,
    async (job) => {
      const { rewriteVersionId, workspaceId } = job.data;

      console.log("[RewriteWorker] Processing job", {
        jobId: job.id,
        rewriteVersionId,
        workspaceId,
      });

      // 1. Load RewriteVersion → Rewrite → targetAccount
      const version = await prisma.rewriteVersion.findUnique({
        where: { id: rewriteVersionId },
        include: {
          rewrite: {
            include: {
              targetAccount: {
                select: { id: true, nickname: true, signature: true },
              },
            },
          },
        },
      });

      if (!version) {
        throw new Error(`RewriteVersion not found: ${rewriteVersionId}`);
      }

      // 2. Load AiWorkspace (transcript + annotations)
      const workspace = await prisma.aiWorkspace.findUnique({
        where: { id: workspaceId },
        include: {
          transcript: true,
          annotations: { orderBy: { createdAt: "asc" } },
        },
      });

      if (!workspace) {
        throw new Error(`AiWorkspace not found: ${workspaceId}`);
      }

      const transcriptText =
        workspace.transcript?.currentText?.trim() ??
        workspace.transcript?.originalText?.trim() ??
        "";

      // 3. Load fragments
      const usedFragmentIds = (version.usedFragmentIds as string[]) ?? [];
      const fragments =
        usedFragmentIds.length > 0
          ? await prisma.fragment.findMany({
              where: { id: { in: usedFragmentIds } },
              select: { id: true, content: true },
            })
          : [];

      // Preserve original order from usedFragmentIds
      const orderedFragments = usedFragmentIds
        .map((id) => fragments.find((f) => f.id === id))
        .filter((f): f is NonNullable<typeof f> => f !== undefined);

      // 4. Load model config (raw, with API key)
      if (!version.modelConfigId) {
        throw new Error(`RewriteVersion ${rewriteVersionId} has no modelConfigId`);
      }
      const modelConfig = await prisma.aiModelConfig.findUnique({
        where: { id: version.modelConfigId },
      });
      if (!modelConfig) {
        throw new Error(`AiModelConfig not found: ${version.modelConfigId}`);
      }

      // 5. Build prompts
      const targetAccount = version.rewrite.targetAccount;
      const systemPrompt = buildRewriteSystemPrompt();
      const userPrompt = buildRewriteUserPrompt({
        targetAccountNickname: targetAccount?.nickname ?? "未知账号",
        targetAccountSignature: targetAccount?.signature ?? null,
        annotations: workspace.annotations,
        transcriptText,
        fragments: orderedFragments,
        userInputContent: version.userInputContent ?? null,
      });

      // 6. Call AI gateway
      const result = await aiGateway.generateRewrite({
        modelConfig,
        systemPrompt,
        userPrompt,
      });

      // 7. Persist success
      await rewriteRepository.markVersionCompleted(rewriteVersionId, result.text);

      console.log("[RewriteWorker] Completed job", {
        jobId: job.id,
        rewriteVersionId,
        textLength: result.text.length,
      });
    },
    {
      connection: createBullMQRedisConnection(),
      concurrency: 2,
    },
  );

  worker.on("failed", async (job, error) => {
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    const maxAttempts = job?.opts.attempts ?? 3;

    console.warn("[RewriteWorker] Job attempt failed", {
      jobId: job?.id ?? null,
      rewriteVersionId: job?.data.rewriteVersionId ?? null,
      attemptsMade: job?.attemptsMade ?? null,
      maxAttempts,
      error: errorMessage,
    });

    if (!job || job.attemptsMade < (job.opts.attempts ?? 3)) {
      return;
    }

    try {
      console.error("[RewriteWorker] Job failed permanently", {
        jobId: job.id,
        rewriteVersionId: job.data.rewriteVersionId,
        attemptsMade: job.attemptsMade,
        maxAttempts,
        error: errorMessage,
      });

      await rewriteRepository.markVersionFailed(job.data.rewriteVersionId, errorMessage);
    } catch (handlerError) {
      console.error("[RewriteWorker] Failed to persist FAILED state:", handlerError);
    }
  });

  console.log("[RewriteWorker] Worker started.");
}
