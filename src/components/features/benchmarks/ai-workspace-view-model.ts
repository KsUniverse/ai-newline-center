"use client";

import type { AiWorkspaceDTO } from "@/types/ai-workspace";
import type { DouyinVideoDTO } from "@/types/douyin-account";

export interface TranscriptSegmentDraft {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  summary: string;
  purpose: string;
}

export interface SelectedTextRange {
  segmentId: string | null;
  startOffset: number;
  endOffset: number;
  quotedText: string;
}

export interface DecompositionAnnotation {
  id: string;
  segmentId: string;
  startOffset: number;
  endOffset: number;
  quotedText: string;
  function: string;
  argumentRole: string;
  technique: string;
  purpose: string;
  effectiveness: string;
  note: string;
}

export interface HighlightChunk {
  key: string;
  text: string;
  annotationIds: string[];
  overlapCount: number;
  showOverlapBadge: boolean;
  hasAnnotation: boolean;
  selected: boolean;
}

export interface CollapsedQuoteParts {
  head: string;
  tail: string;
  omittedCount: number;
  collapsed: boolean;
}

export function buildInitialTranscript(video: DouyinVideoDTO): string {
  const sourceLink = video.shareUrl ?? video.videoSourceUrl ?? video.videoUrl ?? "未同步分享链接";
  const tagLine = video.tags.length > 0 ? video.tags.join(" / ") : "暂无标签";

  return [
    video.title,
    `素材链接：${sourceLink}`,
    `标签：${tagLine}`,
    "",
    "这一段先保留主张，再拆成可编辑的语义段。",
    "这里补充一句转场，让后面的拆解区能继续承接论点。",
    "最后一段收束到仿写的表达节奏，便于对照编辑。",
  ].join("\n");
}

export function splitTranscriptIntoSegments(text: string): TranscriptSegmentDraft[] {
  const chunks = text
    .split(/\n\s*\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    return [
      {
        id: "segment-empty",
        text: "当前视频还没有可编辑的转录稿。",
        startOffset: 0,
        endOffset: 14,
        summary: "待整理",
        purpose: "待确认",
      },
    ];
  }

  let cursor = 0;

  return chunks.map((chunk, index) => {
    const startOffset = cursor;
    const endOffset = cursor + chunk.length;
    cursor = endOffset + 2;

    return {
      id: `segment-${index + 1}`,
      text: chunk,
      startOffset,
      endOffset,
      summary: index === 0 ? "开场铺垫" : index === chunks.length - 1 ? "收束与转写" : "承接论点",
      purpose: index === 0 ? "建立语境" : index === chunks.length - 1 ? "推进仿写" : "补足结构",
    };
  });
}

export function buildSourceLabel(video: DouyinVideoDTO): string {
  return video.shareUrl ?? video.videoSourceUrl ?? video.videoUrl ?? "分享链接未同步";
}

export function mapWorkspaceAnnotations(
  workspace: AiWorkspaceDTO | null,
): DecompositionAnnotation[] {
  if (!workspace || workspace.annotations.length === 0) {
    return [];
  }

  return workspace.annotations.map((annotation) => ({
    id: annotation.id,
    segmentId: annotation.segmentId ?? "",
    startOffset: annotation.startOffset,
    endOffset: annotation.endOffset,
    quotedText: annotation.quotedText,
    function: annotation.function ?? "",
    argumentRole: annotation.argumentRole ?? "",
    technique: annotation.technique ?? "",
    purpose: annotation.purpose ?? "",
    effectiveness: annotation.effectiveness ?? "",
    note: annotation.note ?? "",
  }));
}

export function splitCollapsedQuote(
  text: string,
  headLength: number = 38,
  tailLength: number = 32,
): CollapsedQuoteParts {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= headLength + tailLength + 16) {
    return {
      head: normalized,
      tail: "",
      omittedCount: 0,
      collapsed: false,
    };
  }

  return {
    head: normalized.slice(0, headLength),
    tail: normalized.slice(-tailLength),
    omittedCount: Math.max(0, normalized.length - headLength - tailLength),
    collapsed: true,
  };
}

export function buildTranscriptHighlightChunks(
  text: string,
  annotations: DecompositionAnnotation[],
  selectedRange: SelectedTextRange | null,
  activeAnnotationId: string | null,
): HighlightChunk[] {
  const boundaries = new Set<number>([0, text.length]);

  if (selectedRange) {
    boundaries.add(selectedRange.startOffset);
    boundaries.add(selectedRange.endOffset);
  } else {
    for (const annotation of annotations) {
      boundaries.add(annotation.startOffset);
      boundaries.add(annotation.endOffset);
    }
  }

  const sorted = Array.from(boundaries).sort((left, right) => left - right);
  const chunks: HighlightChunk[] = [];
  let previousBadgeKey = "";

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];

    if (start === undefined || end === undefined || start === end) {
      continue;
    }

    const chunkText = text.slice(start, end);
    if (!chunkText) {
      continue;
    }

    const coveringAnnotations = selectedRange
      ? []
      : annotations.filter(
          (annotation) => start >= annotation.startOffset && end <= annotation.endOffset,
        );
    const visibleAnnotations = activeAnnotationId
      ? coveringAnnotations.filter((annotation) => annotation.id === activeAnnotationId)
      : coveringAnnotations;
    const badgeKey = coveringAnnotations.map((annotation) => annotation.id).join(",");

    chunks.push({
      key: `${start}-${end}`,
      text: chunkText,
      annotationIds: visibleAnnotations.map((annotation) => annotation.id),
      overlapCount: coveringAnnotations.length,
      showOverlapBadge:
        !selectedRange &&
        !activeAnnotationId &&
        coveringAnnotations.length > 1 &&
        badgeKey !== previousBadgeKey,
      hasAnnotation: visibleAnnotations.length > 0,
      selected:
        selectedRange !== null &&
        start >= selectedRange.startOffset &&
        end <= selectedRange.endOffset,
    });

    previousBadgeKey = badgeKey;
  }

  return chunks;
}
