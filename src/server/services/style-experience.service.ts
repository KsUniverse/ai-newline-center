import { prisma } from "@/lib/prisma";
import { styleExperienceRepository } from "@/server/repositories/style-experience.repository";

function computeQualityScore(
  playsCount: number,
  likesCount: number,
  commentsCount: number,
  sharesCount: number,
): number {
  return playsCount + likesCount * 10 + commentsCount * 5 + sharesCount * 3;
}

class StyleExperienceService {
  async upsertForVideo(videoId: string): Promise<void> {
    // 1. Load VideoRewriteLink with nested rewrite data
    const link = await prisma.videoRewriteLink.findUnique({
      where: { videoId },
      include: {
        rewrite: {
          select: {
            id: true,
            targetAccountId: true,
            organizationId: true,
          },
        },
      },
    });

    if (!link || !link.rewrite.targetAccountId) {
      return;
    }

    const { rewrite } = link;
    // targetAccountId is guaranteed non-null by the guard above
    const accountId = rewrite.targetAccountId!;

    // 2. Load final version
    const finalVersion = await prisma.rewriteVersion.findFirst({
      where: {
        rewriteId: rewrite.id,
        isFinalVersion: true,
      },
      orderBy: { versionNumber: "desc" },
      select: {
        generatedContent: true,
        editedContent: true,
      },
    });

    if (!finalVersion) {
      return;
    }

    const aiContent = finalVersion.generatedContent;
    const finalContent = finalVersion.editedContent ?? finalVersion.generatedContent;

    if (!aiContent || !finalContent) {
      return;
    }

    // 3. Load latest VideoSnapshot
    const snapshot = await prisma.videoSnapshot.findFirst({
      where: { videoId },
      orderBy: { timestamp: "desc" },
    });

    if (!snapshot) {
      return;
    }

    // 4. Compute quality score
    const qualityScore = computeQualityScore(
      snapshot.playsCount,
      snapshot.likesCount,
      snapshot.commentsCount,
      snapshot.sharesCount,
    );

    // 5. Upsert StyleExperience
    await styleExperienceRepository.upsert({
      accountId,
      rewriteId: rewrite.id,
      videoId,
      aiContent,
      finalContent,
      playsCount: snapshot.playsCount,
      likesCount: snapshot.likesCount,
      commentsCount: snapshot.commentsCount,
      sharesCount: snapshot.sharesCount,
      qualityScore,
      organizationId: rewrite.organizationId,
    });
  }

  async getFewShotExamples(
    accountId: string,
    organizationId: string,
    limit: number,
  ): Promise<string | null> {
    const experiences = await styleExperienceRepository.findTopByAccountId(
      accountId,
      organizationId,
      limit,
    );

    if (experiences.length === 0) {
      return null;
    }

    const accountName = await prisma.douyinAccount
      .findUnique({ where: { id: accountId }, select: { nickname: true } })
      .then((a) => a?.nickname ?? "该账号");

    const examplesText = experiences
      .map((exp, idx) => {
        return [
          `案例 ${idx + 1}（播放 ${exp.playsCount.toLocaleString()}，点赞 ${exp.likesCount.toLocaleString()}）：`,
          exp.finalContent,
        ].join("\n");
      })
      .join("\n\n");

    return [
      `【账号历史优秀案例参考】`,
      `以下是「${accountName}」账号的历史仿写优秀案例（按数据表现排序），供参考其风格：`,
      ``,
      examplesText,
    ].join("\n");
  }
}

export const styleExperienceService = new StyleExperienceService();
