import { douyinAccountStyleProfileRepository } from "@/server/repositories/douyin-account-style-profile.repository";
import { rewriteLearningCaseRepository } from "@/server/repositories/rewrite-learning-case.repository";

function splitSentences(content: string): string[] {
  return content
    .split(/[。！？!?；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function topDistinct(values: string[], limit: number): string[] {
  return Array.from(new Set(values.filter(Boolean))).slice(0, limit);
}

class DouyinAccountStyleProfileService {
  async rebuildForAccount(targetAccountId: string, organizationId: string) {
    const cases = await rewriteLearningCaseRepository.findActiveByTargetAccountId(
      targetAccountId,
      organizationId,
    );

    const sampleCount = cases.length;
    if (sampleCount < 2) {
      return douyinAccountStyleProfileRepository.upsert({
        targetAccountId,
        organizationId,
        summary: null,
        toneKeywords: [],
        structurePatterns: [],
        openingPatterns: [],
        ctaPatterns: [],
        avoidPatterns: [],
        sampleCount,
        lastBuiltAt: new Date(),
      });
    }

    const topCases = cases.slice(0, 3);
    const openings = topDistinct(
      topCases
        .map((item) => splitSentences(item.finalContentSnapshot)[0] ?? item.finalContentSnapshot.slice(0, 24))
        .filter(Boolean),
      3,
    );
    const endings = topDistinct(
      topCases
        .map((item) => {
          const sentences = splitSentences(item.finalContentSnapshot);
          return sentences[sentences.length - 1] ?? item.finalContentSnapshot.slice(-24);
        })
        .filter(Boolean),
      3,
    );
    const toneKeywords = topDistinct(
      [
        "口语化",
        "结构清晰",
        topCases.some((item) => item.finalContentSnapshot.includes("你")) ? "对话感" : "",
        topCases.some((item) => item.finalContentSnapshot.includes("为什么")) ? "提问开场" : "",
      ],
      5,
    );
    const structurePatterns = topDistinct(
      ["开头钩子", "主体展开", "结尾收束", ...openings.map(() => "案例带观点推进")],
      4,
    );
    const summary = [
      `该账号当前累计 ${sampleCount} 条有效学习案例。`,
      `高表现文案普遍采用${structurePatterns.join("、")}的组织方式，`,
      `开头常见表达包括：${openings.join("；")}。`,
      endings.length > 0 ? `结尾常以“${endings.join("；")}”收束。` : "",
    ]
      .join("")
      .trim();

    return douyinAccountStyleProfileRepository.upsert({
      targetAccountId,
      organizationId,
      summary,
      toneKeywords,
      structurePatterns,
      openingPatterns: openings,
      ctaPatterns: endings,
      avoidPatterns: [],
      sampleCount,
      lastBuiltAt: new Date(),
    });
  }
}

export const douyinAccountStyleProfileService = new DouyinAccountStyleProfileService();
