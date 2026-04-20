"use client";

import { memo, useMemo, useRef } from "react";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { AiWorkspaceStage } from "./ai-workspace-controller";
import {
  buildTranscriptHighlightChunks,
  type DecompositionAnnotation,
  type SelectedTextRange,
} from "./ai-workspace-view-model";

interface AiWorkspaceTranscriptCanvasProps {
  stage: AiWorkspaceStage;
  transcriptText: string;
  transcribing: boolean;
  canGenerate: boolean;
  locked: boolean;
  annotations: DecompositionAnnotation[];
  selectedRange: SelectedTextRange | null;
  activeAnnotationId: string | null;
  compactVideo?: ReactNode;
  onGenerate: () => void;
  onToggleLock: () => void;
  onTextRangeSelect: (range: SelectedTextRange) => void;
  onAnnotationSelect: (annotationId: string) => void;
  onTranscriptTextChange: (next: string) => void;
}

export const AiWorkspaceTranscriptCanvas = memo(function AiWorkspaceTranscriptCanvas({
  stage,
  transcriptText,
  transcribing,
  canGenerate,
  locked,
  annotations,
  selectedRange,
  activeAnnotationId,
  compactVideo,
  onGenerate,
  onToggleLock,
  onTextRangeSelect,
  onAnnotationSelect,
  onTranscriptTextChange,
}: AiWorkspaceTranscriptCanvasProps) {
  const documentRef = useRef<HTMLDivElement | null>(null);
  const highlightChunks = useMemo(
    () =>
      buildTranscriptHighlightChunks(
        transcriptText,
        annotations,
        selectedRange,
        activeAnnotationId,
      ),
    [activeAnnotationId, annotations, selectedRange, transcriptText],
  );

  function handleMouseUp() {
    const selection = window.getSelection();
    const container = documentRef.current;

    if (!selection || selection.rangeCount === 0 || !container) {
      return;
    }

    const range = selection.getRangeAt(0);
    const quotedText = selection.toString().trim();

    if (!quotedText || selection.isCollapsed || !container.contains(range.commonAncestorContainer)) {
      return;
    }

    const startRange = document.createRange();
    startRange.selectNodeContents(container);
    startRange.setEnd(range.startContainer, range.startOffset);

    const endRange = document.createRange();
    endRange.selectNodeContents(container);
    endRange.setEnd(range.endContainer, range.endOffset);

    onTextRangeSelect({
      segmentId: null,
      startOffset: startRange.toString().length,
      endOffset: endRange.toString().length,
      quotedText,
    });

    selection.removeAllRanges();
  }

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_32%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.05),transparent_36%)]" />
      <div className="border-b border-border/35 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
              Transcript Hub
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-foreground/95">
              转录主文档
            </h3>
          </div>
          <Badge variant="secondary" className="rounded-md border border-border/45 bg-background/80 px-2.5 py-1 text-xs">
            {stage === "rewrite" ? "仿写参考" : stage === "decompose" ? "拆解中轴" : "转录编辑"}
          </Badge>
        </div>

        {stage === "rewrite" && compactVideo ? (
          <div className="mt-4">{compactVideo}</div>
        ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/55 bg-background/80 px-3.5 py-3 text-xs text-muted-foreground/75">
          <p className="min-w-0 truncate leading-5">
            {stage === "rewrite"
              ? "已进入仿写阶段，当前正文只作为锁定参考，不再允许重回转录和拆解。"
              : locked
                ? "直接划词进入拆解输入，点击右侧明细聚焦对应原文。"
                : "先修正文案，再锁定进入拆解阶段。"}
          </p>
          <button
            type="button"
            onClick={onToggleLock}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              locked
                ? "border-border/55 bg-card/90 text-foreground"
                : "border-primary/20 bg-primary/10 text-primary",
            )}
          >
            <span
              className={cn("h-2 w-2 rounded-full", locked ? "bg-foreground/70" : "bg-primary")}
            />
            {locked ? "锁定编辑" : "可编辑"}
          </button>
        </div>

        {locked ? (
          <div
            ref={documentRef}
            onMouseUp={handleMouseUp}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-xl border border-border/55 bg-card/82 px-4 py-4 text-sm leading-7 text-foreground"
          >
            <div className="whitespace-pre-wrap wrap-anywhere">
              {highlightChunks.map((chunk) => {
                const annotationId = chunk.annotationIds[0];

                return (
                  <span
                    key={chunk.key}
                    onClick={() => {
                      if (annotationId) {
                        onAnnotationSelect(annotationId);
                      }
                    }}
                    className={cn(
                      "rounded-lg px-0.5 py-0.5 transition-all",
                      chunk.annotationIds.length > 0 &&
                        "cursor-pointer hover:-translate-y-px hover:bg-primary/8",
                      !selectedRange &&
                        !activeAnnotationId &&
                        chunk.hasAnnotation &&
                        "bg-primary/12 ring-1 ring-primary/18",
                      !selectedRange &&
                        !activeAnnotationId &&
                        chunk.overlapCount > 1 &&
                        "bg-primary/18 ring-1 ring-primary/28 shadow-primary/10",
                      activeAnnotationId &&
                        chunk.annotationIds.includes(activeAnnotationId) &&
                        "bg-primary/18 ring-2 ring-primary/36 shadow-primary/12",
                      selectedRange && chunk.selected && "bg-primary/20 ring-2 ring-primary/34",
                    )}
                  >
                    {chunk.text}
                    {chunk.showOverlapBadge ? (
                      <sup className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                        {chunk.overlapCount}
                      </sup>
                    ) : null}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <textarea
            value={transcriptText}
            onChange={(event) => onTranscriptTextChange(event.target.value)}
            readOnly={transcribing}
            rows={16}
            className={cn(
              "min-h-0 flex-1 resize-none overflow-y-auto overflow-x-hidden rounded-xl border border-border/55 bg-card/82 px-4 py-4 text-sm leading-7 text-foreground wrap-anywhere outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/30 focus:ring-2 focus:ring-primary/10",
              transcribing && "cursor-not-allowed opacity-80",
            )}
            placeholder="点击 AI 转录生成主文档，随后修正文案用词和段落。"
          />
        )}

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/55 bg-background/80 px-3.5 py-3">
          <Button
            size="sm"
            className="h-8 rounded-md px-3 text-sm"
            disabled={!canGenerate || transcribing}
            onClick={onGenerate}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {transcribing ? "转录生成中…" : "AI 转录"}
          </Button>
          <span className="text-xs text-muted-foreground/70">
            {stage === "rewrite"
              ? "仿写阶段已锁定，不再允许重新转录"
              : stage === "decompose"
                ? "重新转录会清空当前转录与拆解"
                : locked
                  ? `${annotations.length} 条拆解锚点`
                  : "转录完成后可锁定进入拆解阶段"}
          </span>
        </div>
      </div>
    </section>
  );
});
