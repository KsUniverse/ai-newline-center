"use client";

import { memo, useMemo } from "react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

import type { GenerateRewriteInput, RewriteDTO } from "@/types/ai-workspace";
import { buildTranscriptHighlightChunks, type DecompositionAnnotation } from "./ai-workspace-view-model";
import { AiRewritePanel } from "./ai-rewrite-panel";

export interface AiWorkspaceRewriteStageV2Props {
  transcriptText: string;
  annotations: DecompositionAnnotation[];
  activeAnnotationId: string | null;
  onAnnotationSelect: (id: string) => void;
  // rewrite
  videoId: string;
  rewrite: RewriteDTO | null;
  activeVersionId: string | null;
  generatingRewrite: boolean;
  onGenerateRewrite: (input: GenerateRewriteInput) => void;
  onSaveVersionEdit: (versionId: string, content: string) => void;
  onSetActiveVersionId: (id: string) => void;
}

export const AiWorkspaceRewriteStageV2 = memo(function AiWorkspaceRewriteStageV2({
  transcriptText,
  annotations,
  activeAnnotationId,
  onAnnotationSelect,
  videoId,
  rewrite,
  activeVersionId,
  generatingRewrite,
  onGenerateRewrite,
  onSaveVersionEdit,
  onSetActiveVersionId,
}: AiWorkspaceRewriteStageV2Props) {
  const highlightChunks = useMemo(
    () => buildTranscriptHighlightChunks(transcriptText, annotations, null, activeAnnotationId),
    [transcriptText, annotations, activeAnnotationId],
  );

  return (
    <div className="flex h-full min-h-0">
      {/* Left column — annotation list ~25% */}
      <div className="flex min-h-0 basis-[25%] flex-col border-r border-border/60">
        <div className="border-b border-border/60 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
                Decomposition
              </p>
              <h3 className="text-base font-semibold tracking-tight text-foreground/95">
                拆解批注
              </h3>
            </div>
            <Badge
              variant="secondary"
              className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs shadow-sm"
            >
              {annotations.length} 条
            </Badge>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
          {annotations.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-muted-foreground/60 leading-6">
                暂无拆解批注
              </p>
              <p className="text-xs text-muted-foreground/40 leading-5">
                请先在拆解阶段完成批注
              </p>
            </div>
          ) : (
            annotations.map((annotation) => {
              const isActive = annotation.id === activeAnnotationId;
              return (
                <button
                  key={annotation.id}
                  type="button"
                  onClick={() => onAnnotationSelect(annotation.id)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left transition-all hover:-translate-y-px",
                    isActive
                      ? "border-primary/30 bg-primary/10 shadow-sm shadow-primary/10"
                      : "border-border/60 bg-card/80 hover:bg-card/90",
                  )}
                >
                  <p
                    className={cn(
                      "mb-1.5 text-xs font-medium leading-5 line-clamp-2",
                      isActive ? "text-primary/90" : "text-muted-foreground/80",
                    )}
                  >
                    「
                    {annotation.quotedText.length > 30
                      ? `${annotation.quotedText.slice(0, 30)}...`
                      : annotation.quotedText}
                    」
                  </p>
                  {(annotation.note || annotation.function) && (
                    <p className="text-xs text-foreground/70 leading-5 line-clamp-2">
                      {annotation.note || annotation.function}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Middle column — transcript read-only with highlights ~35% */}
      <div className="flex min-h-0 basis-[35%] flex-col border-r border-border/60">
        <div className="border-b border-border/60 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
                Transcript
              </p>
              <h3 className="text-base font-semibold tracking-tight text-foreground/95">
                转录原文
              </h3>
            </div>
            <Badge
              variant="secondary"
              className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs shadow-sm"
            >
              仿写参考
            </Badge>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {transcriptText ? (
            <div className="text-sm leading-7 text-foreground whitespace-pre-wrap wrap-anywhere">
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
                      "rounded-lg px-0.5 py-0.5",
                      annotationId && "cursor-pointer transition-all hover:-translate-y-px hover:bg-primary/8",
                      !activeAnnotationId &&
                        chunk.hasAnnotation &&
                        "bg-primary/12 ring-1 ring-primary/18",
                      activeAnnotationId &&
                        chunk.annotationIds.includes(activeAnnotationId) &&
                        "bg-primary/18 ring-2 ring-primary/36 shadow-sm shadow-primary/12",
                    )}
                  >
                    {chunk.text}
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground/60">暂无转录文案</p>
            </div>
          )}
        </div>
      </div>

      {/* Right column — rewrite panel ~40% */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.06),transparent_30%)]" />
        <div className="border-b border-border/60 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
                Rewrite Studio
              </p>
              <h3 className="text-base font-semibold tracking-tight text-foreground/95">
                仿写区
              </h3>
            </div>
            <Badge
              variant="secondary"
              className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs shadow-sm"
            >
              {rewrite?.versions.length ? `${rewrite.versions.length} 个版本` : "首次生成"}
            </Badge>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <AiRewritePanel
            annotations={annotations}
            videoId={videoId}
            rewrite={rewrite}
            activeVersionId={activeVersionId}
            generatingRewrite={generatingRewrite}
            onGenerateRewrite={onGenerateRewrite}
            onSaveVersionEdit={onSaveVersionEdit}
            onSetActiveVersionId={onSetActiveVersionId}
          />
        </div>
      </div>
    </div>
  );
});
