import { douyinAccountStyleProfileRepository } from "@/server/repositories/douyin-account-style-profile.repository";
import { rewriteLearningCaseRepository } from "@/server/repositories/rewrite-learning-case.repository";
import {
  buildLearningEmbedding,
  cosineSimilarity,
} from "@/server/services/rewrite-learning-vector";

interface RetrievalAnnotationInput {
  quotedText: string;
  note?: string | null;
  function?: string | null;
}

interface RetrieveForRewriteInput {
  organizationId: string;
  targetAccountId: string;
  transcriptText?: string | null;
  annotations?: RetrievalAnnotationInput[];
  viewpoints?: string[];
  topic?: string | null;
  limit?: number;
}

function buildQueryText(input: RetrieveForRewriteInput): string {
  return [
    input.topic ? `【主题】\n${input.topic}` : "",
    input.transcriptText ? `【对标原文】\n${input.transcriptText}` : "",
    input.annotations && input.annotations.length > 0
      ? `【拆解】\n${input.annotations
          .map((item) => `${item.quotedText}：${item.note ?? item.function ?? "无说明"}`)
          .join("\n")}`
      : "",
    input.viewpoints && input.viewpoints.length > 0
      ? `【观点】\n${input.viewpoints.join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildRecencyScore(isoDate: string): number {
  const ageDays = Math.max(
    (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24),
    0,
  );
  return Math.max(0, 1 - ageDays / 180);
}

export class RewriteLearningRetrievalService {
  async retrieveForRewrite(input: RetrieveForRewriteInput) {
    const limit = input.limit ?? 6;
    const [profile, activeCases] = await Promise.all([
      douyinAccountStyleProfileRepository.findByTargetAccountId(input.targetAccountId),
      rewriteLearningCaseRepository.findActiveByTargetAccountId(
        input.targetAccountId,
        input.organizationId,
      ),
    ]);

    const queryText = buildQueryText(input);
    const queryVector = buildLearningEmbedding(queryText);
    const rankedCases = activeCases
      .map((item) => {
        const embedding = Array.isArray(item.embeddingJson) ? (item.embeddingJson as number[]) : [];
        const similarity = cosineSimilarity(queryVector, embedding);
        const normalizedPerformanceScore = Math.max(
          0,
          Math.min(item.performanceScore / 100, 1),
        );
        const recencyScore = buildRecencyScore(item.updatedAt.toISOString());
        const rankScore =
          similarity * 0.55 + normalizedPerformanceScore * 0.35 + recencyScore * 0.1;

        return {
          id: item.id,
          finalContentSnapshot: item.finalContentSnapshot,
          sourceTranscriptSnapshot: item.sourceTranscriptSnapshot,
          sourceAnnotationsSnapshot: item.sourceAnnotationsSnapshot,
          metricsSnapshot: item.metricsSnapshot,
          performanceScore: item.performanceScore,
          similarity,
          rankScore,
        };
      })
      .sort((left, right) => right.rankScore - left.rankScore)
      .slice(0, limit);

    const profileSummary = profile?.summary ?? null;
    const inheritanceHints = rankedCases
      .slice(0, 3)
      .map((item, index) => `经验 ${index + 1}：优先学习其开头节奏和结尾收束方式`)
      .join("\n");

    return {
      profile,
      cases: rankedCases,
      snapshot: {
        queryText,
        profileSummary,
        caseIds: rankedCases.map((item) => item.id),
        inheritanceHints,
      },
    };
  }
}

export const rewriteLearningRetrievalService = new RewriteLearningRetrievalService();
