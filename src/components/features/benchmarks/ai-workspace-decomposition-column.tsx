"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { AiWorkspaceMode } from "./ai-workspace-layout";
import { formatCollapsedQuote, type DecompositionAnnotation, type SelectedTextRange } from "./ai-workspace-model";

interface AiWorkspaceDecompositionColumnProps {
  mode: AiWorkspaceMode;
  annotations: DecompositionAnnotation[];
  selectedRange: SelectedTextRange | null;
  isManualSelection: boolean;
  activeAnnotationId: string | null;
  onClearSelection: () => void;
  onAnnotationSelect: (annotationId: string) => void;
  onCreateAnnotation: (annotation: DecompositionAnnotation) => void;
}

export function AiWorkspaceDecompositionColumn({
  mode,
  annotations,
  selectedRange,
  isManualSelection,
  activeAnnotationId,
  onClearSelection,
  onAnnotationSelect,
  onCreateAnnotation,
}: AiWorkspaceDecompositionColumnProps) {
  const annotationRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [panelMode, setPanelMode] = useState<"input" | "details">("details");
  const [content, setContent] = useState("");

  useEffect(() => {
    setContent("");
    if (selectedRange && isManualSelection) {
      setPanelMode("input");
    }
  }, [selectedRange, isManualSelection, mode]);

  useEffect(() => {
    if (!activeAnnotationId) return;
    annotationRefs.current[activeAnnotationId]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeAnnotationId]);

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      <div className="border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="mt-1 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight text-foreground/95">拆解区</h3>
          <button
            type="button"
            onClick={() => setPanelMode((current) => (current === "details" ? "input" : "details"))}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              panelMode === "details"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground"
            }`}
          >
            {annotations.length} 条拆解
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-5">
        {panelMode === "input" ? (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">当前选区</p>
                <div className="flex items-center gap-2">
                  {selectedRange ? (
                    <Badge variant="secondary" className="text-2xs">
                      {selectedRange.startOffset}-{selectedRange.endOffset}
                    </Badge>
                  ) : null}
                  {selectedRange ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClearSelection();
                        setPanelMode("details");
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground transition-colors hover:border-primary/20 hover:text-foreground"
                      aria-label="清除选区"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="min-h-[72px] whitespace-pre-wrap [overflow-wrap:anywhere] break-words text-sm leading-6 text-foreground/90">
                {selectedRange?.quotedText || "请先在左侧主文档中框选任意一句话、片段或整段，再来填写拆解。"}
              </div>
            </div>

            <div className="grid gap-3">
              <label className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                拆解内容
              </label>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={8}
                className="w-full resize-none rounded-2xl border border-border/60 bg-card/95 px-4 py-3 text-sm leading-7 text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                placeholder="直接写这一段为什么好、用了什么写法、目的是什么。"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="h-8 rounded-md px-3 text-sm"
                  disabled={!selectedRange?.quotedText || !content.trim()}
                  onClick={() => {
                    if (!selectedRange) return;
                    onCreateAnnotation({
                      id: `annotation-${Date.now()}`,
                      segmentId: selectedRange.segmentId ?? "",
                      startOffset: selectedRange.startOffset,
                      endOffset: selectedRange.endOffset,
                      quotedText: selectedRange.quotedText,
                      function: content.trim(),
                      argumentRole: "",
                      technique: "",
                      purpose: "",
                      effectiveness: "",
                      note: content.trim(),
                    });
                  }}
                >
                  保存拆解
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="space-y-3 pr-1">
              {annotations.map((annotation, index) => (
                <button
                  key={annotation.id}
                  ref={(node) => {
                    annotationRefs.current[annotation.id] = node;
                  }}
                  type="button"
                  onClick={() => onAnnotationSelect(annotation.id)}
                  className={`w-full rounded-2xl border border-border/60 bg-transparent p-3 text-left transition-all hover:border-primary/25 hover:bg-primary/5 ${
                    activeAnnotationId === annotation.id
                      ? "border-primary/30 bg-primary/6 shadow-primary/10"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                      拆解 {index + 1}
                    </span>
                    <span className="text-2xs text-muted-foreground/70">
                      {annotation.startOffset}-{annotation.endOffset}
                    </span>
                  </div>
                  <TooltipProvider delayDuration={120}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="mt-3 overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-6 text-foreground/90">
                          {formatCollapsedQuote(annotation.quotedText)}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="start"
                        className="max-w-md whitespace-pre-wrap [overflow-wrap:anywhere] break-words rounded-2xl border border-border/60 bg-card/95 px-3 py-2 text-sm leading-6 text-foreground shadow-xl"
                      >
                        {annotation.quotedText}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground/85">{annotation.note || annotation.function}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
