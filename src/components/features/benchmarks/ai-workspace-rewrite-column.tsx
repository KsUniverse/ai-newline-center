"use client";

import { Badge } from "@/components/ui/badge";

import type { DecompositionAnnotation } from "./ai-workspace-model";

interface AiWorkspaceRewriteColumnProps {
  transcriptText: string;
  annotations: DecompositionAnnotation[];
  activeAnnotationId: string | null;
  draft: string;
  onDraftChange: (next: string) => void;
  onAnnotationSelect: (annotationId: string) => void;
}

export function AiWorkspaceRewriteColumn({
  transcriptText,
  annotations,
  activeAnnotationId,
  draft,
  onDraftChange,
  onAnnotationSelect,
}: AiWorkspaceRewriteColumnProps) {
  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      <div className="border-b border-border/60 px-4 py-4 sm:px-5">
        <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">Rewrite Studio</p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground/95">仿写区</h3>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-5">
        <div className="grid gap-3">
          <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">仿写稿</p>
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            rows={16}
            className="w-full resize-none rounded-2xl border border-border/60 bg-card/95 px-4 py-3 text-sm leading-7 text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
            placeholder="在这里写仿写草稿..."
          />
          <div className="flex justify-end">
            <Badge variant="secondary" className="text-xs">
              {draft.length} 字
            </Badge>
          </div>
        </div>

        <div className="grid gap-3">
          <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">原文对照</p>
          <div className="text-sm leading-7 text-foreground/90 whitespace-pre-wrap">
            {transcriptText}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">拆解参考</p>
            <Badge variant="secondary" className="text-xs">
              {annotations.length} 条
            </Badge>
          </div>
          <div className="grid gap-2">
            {annotations.map((annotation) => (
              <button
                key={annotation.id}
                type="button"
                onClick={() => onAnnotationSelect(annotation.id)}
                className={`rounded-2xl border border-border/60 bg-transparent p-3 text-left text-sm transition-all hover:border-primary/25 hover:bg-primary/5 ${
                  activeAnnotationId === annotation.id
                    ? "border-primary/30 bg-primary/6 shadow-primary/10"
                    : ""
                }`}
              >
                <p className="leading-6 text-foreground/90">{annotation.function}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
