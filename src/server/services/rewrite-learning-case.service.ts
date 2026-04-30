import { prisma } from "@/lib/prisma";
import { rewritePublicationRepository } from "@/server/repositories/rewrite-publication.repository";
import {
  rewriteLearningCaseRepository,
  type UpsertRewriteLearningCaseData,
} from "@/server/repositories/rewrite-learning-case.repository";
import { douyinAccountStyleProfileService } from "@/server/services/douyin-account-style-profile.service";
import { buildLearningEmbedding } from "@/server/services/rewrite-learning-vector";

interface MetricsSnapshot {
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  collectCount: number;
  admireCount: number;
  recommendCount: number;
  latestSnapshotAt: string | null;
  growthPlayCount: number;
  likeRate: number;
  commentRate: number;
  shareRate: number;
  collectRate: number;
}

function toInputJsonValue<T>(value: T) {
  return JSON.parse(JSON.stringify(value));
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

function normalizeScore(value: number, ceiling: number): number {
  const normalized = Math.max(0, Math.min(value / ceiling, 1));
  return normalized * 100;
}

function calculateSmoothPerformanceScore(metrics: MetricsSnapshot): number {
  const basePlayScore = normalizeScore(metrics.playCount, 100_000);
  const engagementRateScore = normalizeScore(
    metrics.likeRate * 100 + metrics.commentRate * 300,
    20,
  );
  const shareCollectScore = normalizeScore(
    metrics.shareRate * 400 + metrics.collectRate * 400,
    12,
  );
  const growthScore = normalizeScore(metrics.growthPlayCount, 50_000);

  return Math.round(
    basePlayScore * 0.3 +
      engagementRateScore * 0.45 +
      shareCollectScore * 0.2 +
      growthScore * 0.05,
  );
}

function calculatePercentileScore(values: number[], current: number): number {
  if (values.length === 0) {
    return 0;
  }

  const lowerOrEqual = values.filter((value) => value <= current).length;
  return Math.round((lowerOrEqual / values.length) * 100);
}

function buildEmbeddingText(input: {
  finalContent: string;
  transcript: string | null;
  annotations: Array<{ quotedText: string; note: string | null; fn: string | null }>;
  fragments: string[];
}): string {
  return [
    "【最终稿】",
    input.finalContent,
    input.transcript ? `【原文】\n${input.transcript}` : "",
    input.annotations.length > 0
      ? `【拆解】\n${input.annotations
          .map((item) => `${item.quotedText}：${item.note ?? item.fn ?? "无说明"}`)
          .join("\n")}`
      : "",
    input.fragments.length > 0 ? `【观点】\n${input.fragments.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

class RewriteLearningCaseService {
  async refreshForPublishedVideo(videoId: string): Promise<void> {
    const publication = await rewritePublicationRepository.findActiveByPublishedVideoId(videoId);
    if (!publication) {
      return;
    }

    await this.refreshFromPublication(publication.id);
  }

  async archiveByPublicationId(publicationId: string): Promise<void> {
    await rewriteLearningCaseRepository.archiveByPublicationId(publicationId);
  }

  async refreshFromPublication(publicationId: string) {
    const publication = await prisma.rewritePublication.findUnique({
      where: { id: publicationId },
      include: {
        publishedVideo: {
          include: {
            snapshots: {
              orderBy: { timestamp: "asc" },
            },
          },
        },
        rewriteVersion: {
          include: {
            rewrite: {
              include: {
                workspace: {
                  include: {
                    transcript: true,
                    annotations: {
                      orderBy: { createdAt: "asc" },
                    },
                    video: {
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!publication || publication.status !== "LINKED") {
      return null;
    }

    const finalContent =
      publication.rewriteVersion.editedContent ?? publication.rewriteVersion.generatedContent ?? null;
    if (!finalContent?.trim()) {
      return null;
    }

    const transcript =
      publication.rewriteVersion.rewrite.workspace?.transcript?.currentText?.trim() ??
      publication.rewriteVersion.rewrite.workspace?.transcript?.originalText?.trim() ??
      null;
    const annotations =
      publication.rewriteVersion.rewrite.workspace?.annotations.map((item) => ({
        quotedText: item.quotedText,
        note: item.note ?? null,
        fn: item.function ?? null,
      })) ?? [];
    const usedFragmentIds = (publication.rewriteVersion.usedFragmentIds as string[]) ?? [];
    const fragmentRows =
      usedFragmentIds.length > 0
        ? await prisma.fragment.findMany({
            where: { id: { in: usedFragmentIds } },
            select: { id: true, content: true },
          })
        : [];
    const fragments = usedFragmentIds
      .map((id) => fragmentRows.find((item) => item.id === id)?.content ?? null)
      .filter((item): item is string => Boolean(item));

    const snapshots = publication.publishedVideo.snapshots;
    const firstSnapshot = snapshots[0] ?? null;
    const latestSnapshot = snapshots[snapshots.length - 1] ?? null;

    const metricsSnapshot: MetricsSnapshot = {
      playCount: publication.publishedVideo.playCount,
      likeCount: publication.publishedVideo.likeCount,
      commentCount: publication.publishedVideo.commentCount,
      shareCount: publication.publishedVideo.shareCount,
      collectCount: publication.publishedVideo.collectCount,
      admireCount: publication.publishedVideo.admireCount,
      recommendCount: publication.publishedVideo.recommendCount,
      latestSnapshotAt: latestSnapshot?.timestamp.toISOString() ?? null,
      growthPlayCount:
        latestSnapshot && firstSnapshot
          ? Math.max(latestSnapshot.playsCount - firstSnapshot.playsCount, 0)
          : 0,
      likeRate: safeRate(publication.publishedVideo.likeCount, publication.publishedVideo.playCount),
      commentRate: safeRate(
        publication.publishedVideo.commentCount,
        publication.publishedVideo.playCount,
      ),
      shareRate: safeRate(publication.publishedVideo.shareCount, publication.publishedVideo.playCount),
      collectRate: safeRate(
        publication.publishedVideo.collectCount,
        publication.publishedVideo.playCount,
      ),
    };

    const existingCases = await rewriteLearningCaseRepository.findActiveByTargetAccountId(
      publication.targetAccountId,
      publication.organizationId,
    );

    let performanceScore = calculateSmoothPerformanceScore(metricsSnapshot);
    if (existingCases.length >= 5) {
      const playScore = calculatePercentileScore(
        existingCases.map((item) => {
          const metrics = item.metricsSnapshot as Record<string, number>;
          return Number(metrics.playCount ?? 0);
        }),
        metricsSnapshot.playCount,
      );
      const engagementScore = calculatePercentileScore(
        existingCases.map((item) => {
          const metrics = item.metricsSnapshot as Record<string, number>;
          return Number(metrics.likeRate ?? 0) + Number(metrics.commentRate ?? 0);
        }),
        metricsSnapshot.likeRate + metricsSnapshot.commentRate,
      );
      const shareCollectScore = calculatePercentileScore(
        existingCases.map((item) => {
          const metrics = item.metricsSnapshot as Record<string, number>;
          return Number(metrics.shareRate ?? 0) + Number(metrics.collectRate ?? 0);
        }),
        metricsSnapshot.shareRate + metricsSnapshot.collectRate,
      );
      const growthScore = calculatePercentileScore(
        existingCases.map((item) => {
          const metrics = item.metricsSnapshot as Record<string, number>;
          return Number(metrics.growthPlayCount ?? 0);
        }),
        metricsSnapshot.growthPlayCount,
      );

      performanceScore = Math.round(
        playScore * 0.3 + engagementScore * 0.45 + shareCollectScore * 0.2 + growthScore * 0.05,
      );
    }

    const embeddingText = buildEmbeddingText({
      finalContent,
      transcript,
      annotations,
      fragments,
    });
    const embeddingVector = buildLearningEmbedding(embeddingText);

    const payload: UpsertRewriteLearningCaseData = {
      rewriteVersionId: publication.rewriteVersionId,
      rewriteId: publication.rewriteId,
      publicationId: publication.id,
      targetAccountId: publication.targetAccountId,
      organizationId: publication.organizationId,
      sourceBenchmarkVideoId: publication.rewriteVersion.rewrite.workspace?.video?.id ?? null,
      sourceTranscriptSnapshot: transcript,
      sourceAnnotationsSnapshot: toInputJsonValue(annotations),
      generatedContentSnapshot: publication.rewriteVersion.generatedContent ?? null,
      editedContentSnapshot: publication.rewriteVersion.editedContent ?? null,
      finalContentSnapshot: finalContent,
      usedFragmentSnapshot: toInputJsonValue(fragments),
      metricsSnapshot: toInputJsonValue(metricsSnapshot),
      performanceScore,
      embeddingText,
      embeddingJson: toInputJsonValue(embeddingVector),
      embeddingStatus: "COMPLETED",
      status: "ACTIVE",
    };

    const learningCase = await rewriteLearningCaseRepository.upsert(payload);
    await douyinAccountStyleProfileService.rebuildForAccount(
      publication.targetAccountId,
      publication.organizationId,
    );

    return learningCase;
  }
}

export const rewriteLearningCaseService = new RewriteLearningCaseService();
