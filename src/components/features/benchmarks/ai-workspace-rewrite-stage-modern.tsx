"use client";

import { memo, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { CursorPaginatedData } from "@/types/api";
import type { FragmentDTO } from "@/types/fragment";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { DecompositionAnnotation } from "./ai-workspace-view-model";

interface AiWorkspaceRewriteStageModernProps {
  transcriptText: string;
  annotations: DecompositionAnnotation[];
  activeAnnotationId: string | null;
  draft: string;
  savingDraft: boolean;
  onDraftChange: (next: string) => void;
  onAnnotationSelect: (annotationId: string) => void;
  selectedFragmentIds: string[];
  onFragmentToggle: (id: string) => void;
  onFragmentsClear: () => void;
}

export const AiWorkspaceRewriteStageModern = memo(function AiWorkspaceRewriteStageModern({
  transcriptText,
  annotations,
  activeAnnotationId,
  draft,
  savingDraft,
  onDraftChange,
  onAnnotationSelect,
  selectedFragmentIds,
  onFragmentToggle,
  onFragmentsClear,
}: AiWorkspaceRewriteStageModernProps) {
  const [fragmentQuery, setFragmentQuery] = useState("");
  const [fragments, setFragments] = useState<FragmentDTO[]>([]);
  const [loadingFragments, setLoadingFragments] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingFragments(true);

    const params = new URLSearchParams({ limit: "50", scope: "today" });
    if (fragmentQuery) {
      params.set("q", fragmentQuery);
    }

    void apiClient
      .get<CursorPaginatedData<FragmentDTO>>(`/viewpoints?${params.toString()}`)
      .then((result) => {
        if (!cancelled) {
          setFragments(result.items);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "观点列表加载失败");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingFragments(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fragmentQuery]);

  function handleFragmentQueryChange(value: string) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setFragmentQuery(value);
    }, 300);
  }

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_32%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.05),transparent_36%)]" />
      <div className="border-b border-border/35 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
              Rewrite Studio
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-foreground/95">仿写区</h3>
          </div>
          <Badge
            variant="secondary"
            className="rounded-md border border-border/45 bg-background/80 px-2.5 py-1 text-xs"
          >
            {savingDraft ? "保存中" : `${draft.length} 字`}
          </Badge>
        </div>
      </div>

      <div className="relative grid min-h-0 flex-1 grid-rows-[minmax(0,1.35fr)_minmax(0,0.9fr)] gap-4 px-4 py-4 sm:px-5">
        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <div className="flex min-h-0 flex-col rounded-xl border border-border/55 bg-card/82 px-4 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                仿写稿
              </p>
              <span className="text-xs text-muted-foreground/70">
                先写结构，再调语气和节奏。
              </span>
            </div>
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              rows={16}
              className="min-h-0 flex-1 resize-none rounded-lg border border-border/55 bg-background/82 px-4 py-4 text-sm leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
              placeholder="在这里继续完成仿写草稿。"
            />
          </div>

          <div className="grid min-h-0 grid-rows-[minmax(0,0.8fr)_minmax(0,1fr)] gap-4">
            <div className="min-h-0 rounded-xl border border-border/55 bg-card/82 px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                  原文对照
                </p>
                <Badge
                  variant="secondary"
                  className="rounded-md border border-border/45 bg-background/80 px-2.5 py-1 text-xs"
                >
                  原文
                </Badge>
              </div>
              <div className="h-full overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-foreground/90 wrap-anywhere">
                {transcriptText}
              </div>
            </div>

            <div className="min-h-0 rounded-xl border border-border/55 bg-card/82 px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                  拆解参考
                </p>
                <Badge
                  variant="secondary"
                  className="rounded-md border border-border/45 bg-background/80 px-2.5 py-1 text-xs"
                >
                  {annotations.length} 条
                </Badge>
              </div>
              <div className="space-y-2 overflow-y-auto">
                {annotations.map((annotation) => (
                  <button
                    key={annotation.id}
                    type="button"
                    onClick={() => onAnnotationSelect(annotation.id)}
                    className={`w-full rounded-lg border border-border/55 bg-background/70 px-3 py-2.5 text-left text-sm transition-all hover:border-primary/14 hover:bg-primary/5 ${
                      activeAnnotationId === annotation.id ? "border-primary/30 bg-primary/6 shadow-primary/10" : ""
                    }`}
                  >
                    <p className="line-clamp-2 leading-6 text-foreground/90">
                      {annotation.note || annotation.function}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-[1fr_minmax(280px,1fr)] gap-4">
          <div className="rounded-xl border border-border/55 bg-card/75 px-4 py-4">
            <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
              仿写说明
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground/80">
              仿写区只负责产出新稿。左侧的原文、拆解和今日观点用于给当前创作提供约束，不再混入历史观点，避免参考池过重。
            </p>
          </div>

          <div className="flex min-h-0 flex-col rounded-xl border border-border/55 bg-card/82 px-4 py-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                今日观点参考
              </p>
              <div className="flex items-center gap-2">
                {selectedFragmentIds.length > 0 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-md border border-border/45 bg-background/80 px-2.5 py-1 text-xs"
                  >
                    已选 {selectedFragmentIds.length} 条
                  </Badge>
                ) : null}
                {selectedFragmentIds.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 rounded-lg px-2 text-xs text-muted-foreground/70 hover:text-foreground"
                    onClick={onFragmentsClear}
                  >
                    清空
                  </Button>
                ) : null}
              </div>
            </div>

            <Input
              type="search"
              placeholder="搜索今日观点..."
              onChange={(event) => handleFragmentQueryChange(event.target.value)}
              className="mb-2 h-8 rounded-xl border-border/55 bg-background/80 text-xs"
            />

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadingFragments ? (
                <div className="space-y-2 py-1">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-16 animate-pulse rounded-lg border border-border/55 bg-background/60"
                    />
                  ))}
                </div>
              ) : fragments.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground/50">
                  {fragmentQuery ? "今天没有匹配的观点" : "今日暂无可引用观点，请先前往观点库录入"}
                </p>
              ) : (
                <div className="space-y-2">
                  {fragments.map((fragment) => {
                    const selected = selectedFragmentIds.includes(fragment.id);

                    return (
                      <button
                        key={fragment.id}
                        type="button"
                        onClick={() => onFragmentToggle(fragment.id)}
                        className={`w-full rounded-lg border px-3 py-3 text-left transition-all ${
                          selected
                            ? "border-primary/30 bg-primary/6"
                            : "border-border/55 bg-background/70 hover:border-primary/14 hover:bg-primary/5"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 h-8 w-1 rounded-full ${
                              selected ? "bg-primary/70" : "bg-border/70"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-xs leading-5 text-foreground/90">
                              {fragment.content}
                            </p>
                            <p className="mt-2 text-2xs text-muted-foreground/70">
                              {fragment.createdByUser.name}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
