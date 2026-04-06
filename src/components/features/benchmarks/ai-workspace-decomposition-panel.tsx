"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { AiWorkspaceFocusState } from "./ai-workspace-controller";
import {
  splitCollapsedQuote,
  type DecompositionAnnotation,
  type SelectedTextRange,
} from "./ai-workspace-view-model";

interface AiWorkspaceDecompositionPanelProps {
  focusState: AiWorkspaceFocusState;
  annotations: DecompositionAnnotation[];
  selectedRange: SelectedTextRange | null;
  activeAnnotationId: string | null;
  onClearSelection: () => void;
  onAnnotationSelect: (annotationId: string) => void;
  onCreateAnnotation: (content: string) => void;
}

export const AiWorkspaceDecompositionPanel = memo(function AiWorkspaceDecompositionPanel({
  focusState,
  annotations,
  selectedRange,
  activeAnnotationId,
  onClearSelection,
  onAnnotationSelect,
  onCreateAnnotation,
}: AiWorkspaceDecompositionPanelProps) {
  const annotationRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [content, setContent] = useState("");
  const inputMode = focusState === "selecting" && Boolean(selectedRange);

  useEffect(() => {
    setContent("");
  }, [selectedRange?.startOffset, selectedRange?.endOffset]);

  useEffect(() => {
    if (!activeAnnotationId || inputMode) {
      return;
    }

    annotationRefs.current[activeAnnotationId]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeAnnotationId, inputMode]);

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_32%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.05),transparent_36%)]" />
      <div className="border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
              Decomposition Layer
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-foreground/95">拆解区</h3>
          </div>
          <Badge variant="secondary" className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs shadow-sm">
            {annotations.length} 条拆解
          </Badge>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-5">
        {inputMode ? (
          <>
            <div className="space-y-3 rounded-3xl border border-border/60 bg-card/80 px-4 py-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                  当前选区
                </p>
                <div className="flex items-center gap-2">
                  {selectedRange ? (
                    <Badge variant="secondary" className="text-2xs">
                      {selectedRange.startOffset}-{selectedRange.endOffset}
                    </Badge>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setContent("");
                      onClearSelection();
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground transition-colors hover:border-primary/20 hover:text-foreground"
                    aria-label="清除选区"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="whitespace-pre-wrap text-sm leading-6 text-foreground/90 wrap-anywhere">
                {selectedRange?.quotedText}
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-background/80 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/85">Annotation Note</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground/80">
                说明这一段在结构、表达或节奏上的作用，后续仿写会直接引用这里的拆解。
              </p>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={10}
                className="mt-4 min-h-0 w-full resize-none rounded-2xl border border-border/60 bg-card/82 px-4 py-3 text-sm leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                placeholder="拆解说明: 直接写这一段为什么好、做了什么、为什么值得学。"
              />
              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  className="h-8 rounded-md px-3 text-sm"
                  disabled={!selectedRange?.quotedText || !content.trim()}
                  onClick={() => {
                    onCreateAnnotation(content.trim());
                    setContent("");
                  }}
                >
                  保存拆解
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-3 pr-1">
              {annotations.map((annotation, index) => {
                const quote = splitCollapsedQuote(annotation.quotedText);

                return (
                  <button
                    key={annotation.id}
                    ref={(node) => {
                      annotationRefs.current[annotation.id] = node;
                    }}
                    type="button"
                    onClick={() => onAnnotationSelect(annotation.id)}
                    className={`w-full rounded-3xl border border-border/60 bg-card/75 px-4 py-3 text-left shadow-sm transition-all hover:border-primary/25 hover:bg-primary/5 ${
                      activeAnnotationId === annotation.id
                        ? "border-primary/30 bg-primary/6 shadow-primary/10"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                        拆解 {index + 1}
                      </span>
                      <span className="text-2xs text-muted-foreground/70">
                        {annotation.startOffset}-{annotation.endOffset}
                      </span>
                    </div>

                    <TooltipProvider delayDuration={120}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 overflow-hidden text-sm leading-6 text-foreground/90">
                            <span className="min-w-0 truncate">{quote.head}</span>
                            {quote.collapsed ? (
                              <span className="shrink-0 rounded-full border border-border/60 bg-background/80 px-3 py-0.5 text-[10px] font-medium tracking-[0.18em] text-muted-foreground/85">
                                已省略 {quote.omittedCount} 字
                              </span>
                            ) : null}
                            {quote.collapsed ? (
                              <span className="min-w-0 truncate text-right">{quote.tail}</span>
                            ) : null}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="start"
                          className="max-w-md whitespace-pre-wrap rounded-2xl border border-border/60 bg-card/95 px-3 py-2 text-sm leading-6 text-foreground shadow-xl wrap-anywhere"
                        >
                          {annotation.quotedText}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground/85">
                      {annotation.note || annotation.function}
                    </p>
                  </button>
                );
              })}

              {annotations.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border/60 bg-background/70 px-4 py-6 text-sm leading-6 text-muted-foreground/80">
                  先在左侧主文档里划词，再保存第一条拆解。
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
});
