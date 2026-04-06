import type { DouyinVideoDTO } from "@/types/douyin-account";

export interface TranscriptSegment {
  id: string;
  label: string;
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

export function splitTranscriptIntoSegments(text: string): TranscriptSegment[] {
  const chunks = text
    .split(/\n\s*\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    return [
      {
        id: "segment-empty",
        label: "语义段 1",
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
      label: `语义段 ${index + 1}`,
      text: chunk,
      startOffset,
      endOffset,
      summary: index === 0 ? "开场铺垫" : index === chunks.length - 1 ? "收束与转写" : "承接论点",
      purpose: index === 0 ? "建立语境" : index === chunks.length - 1 ? "推进仿写" : "补足结构",
    };
  });
}

export function createSeedAnnotations(segments: TranscriptSegment[]): DecompositionAnnotation[] {
  const first = segments[0];

  if (!first) {
    return [];
  }

  return [
    {
      id: "annotation-1",
      segmentId: first.id,
      startOffset: first.startOffset,
      endOffset: first.endOffset,
      quotedText: first.text,
      function: "先把读者带入当前语境，再抬高理解成本。",
      argumentRole: "用于建立开场判断。",
      technique: "短句推进",
      purpose: "让仿写时先锁定节奏，再复制句法。",
      effectiveness: "语气更稳，后续内容更容易承接。",
      note: "可在仿写区优先保留起笔位置。",
    },
  ];
}

export function buildSourceLabel(video: DouyinVideoDTO): string {
  return video.shareUrl ?? video.videoSourceUrl ?? video.videoUrl ?? "分享链接未同步";
}

export function buildSegmentRange(segment: TranscriptSegment | undefined): SelectedTextRange | null {
  if (!segment) {
    return null;
  }

  return {
    segmentId: segment.id,
    startOffset: segment.startOffset,
    endOffset: segment.endOffset,
    quotedText: segment.text,
  };
}

export function formatCollapsedQuote(
  text: string,
  headLength: number = 24,
  tailLength: number = 20,
): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= headLength + tailLength + 8) {
    return normalized;
  }

  const head = normalized.slice(0, headLength);
  const tail = normalized.slice(-tailLength);

  return `${head} …… ${tail}`;
}

export function splitCollapsedQuote(
  text: string,
  headLength: number = 26,
  tailLength: number = 24,
): { head: string; tail: string; collapsed: boolean } {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= headLength + tailLength + 8) {
    return {
      head: normalized,
      tail: "",
      collapsed: false,
    };
  }

  return {
    head: normalized.slice(0, headLength),
    tail: normalized.slice(-tailLength),
    collapsed: true,
  };
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

export function buildTranscriptHighlightChunks(
  text: string,
  annotations: DecompositionAnnotation[],
  selectedRange: SelectedTextRange | null,
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

  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  const chunks: HighlightChunk[] = [];

  let previousAnnotationKey = "";

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    if (start === undefined || end === undefined) {
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
    const isSelected = selectedRange
      ? start >= selectedRange.startOffset && end <= selectedRange.endOffset
      : false;
    const annotationKey = coveringAnnotations.map((annotation) => annotation.id).join(",");
    const showOverlapBadge = coveringAnnotations.length > 1 && annotationKey !== previousAnnotationKey;
    previousAnnotationKey = annotationKey;

    chunks.push({
      key: `${start}-${end}`,
      text: chunkText,
      annotationIds: coveringAnnotations.map((annotation) => annotation.id),
      overlapCount: coveringAnnotations.length,
      showOverlapBadge,
      hasAnnotation: coveringAnnotations.length > 0,
      selected: isSelected,
    });
  }

  return chunks;
}
