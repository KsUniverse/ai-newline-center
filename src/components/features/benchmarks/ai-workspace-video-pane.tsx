"use client";

import { forwardRef, memo } from "react";
import { Clock3, Film, Play } from "lucide-react";

import type { DouyinVideoDTO } from "@/types/douyin-account";
import { cn, formatDateTime, formatNumber, proxyImageUrl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

import { buildSourceLabel } from "./ai-workspace-view-model";

interface AiWorkspaceVideoPaneProps {
  video: DouyinVideoDTO;
  compact?: boolean;
  matchCardRatio?: boolean;
  onPreview: () => void;
}

const AiWorkspaceVideoPaneInner = forwardRef<HTMLButtonElement, AiWorkspaceVideoPaneProps>(function AiWorkspaceVideoPaneInner({
  video,
  compact = false,
  matchCardRatio = false,
  onPreview,
}, previewRef) {
  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_36%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.08),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.08]" />

      <div
        className={cn(
          "relative flex min-h-0 flex-1",
          compact ? "gap-3 px-0 py-0" : "flex-col gap-4 px-4 py-4 sm:px-5",
        )}
      >
        <button
          ref={previewRef}
          type="button"
          onClick={onPreview}
          className={cn(
            "group relative overflow-hidden border border-border/60 bg-muted shadow-sm transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            compact
              ? "h-22 w-28 shrink-0 rounded-2xl"
              : matchCardRatio
                ? "aspect-3/4 w-full max-w-90 self-start rounded-[26px] hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/10"
                : "aspect-video w-full rounded-3xl hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/10",
          )}
        >
          {video.coverUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={proxyImageUrl(video.coverUrl)}
              alt={video.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Film className="h-8 w-8" />
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/18 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-sm">
              <Play className="ml-0.5 h-4 w-4" />
            </span>
          </div>
        </button>

        <div className="relative min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-2xs shadow-sm">
              {video.videoStoragePath ? "可转录" : "待同步"}
            </Badge>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground shadow-sm">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDateTime(video.publishedAt)}
            </span>
          </div>

          <div className="space-y-1.5">
            <h2
              className={cn(
                "font-semibold tracking-tight text-foreground/95",
                compact ? "line-clamp-2 text-sm" : "text-lg",
              )}
            >
              {video.title}
            </h2>
            {!compact ? (
              <p className="text-sm leading-6 text-muted-foreground/80">
                点击视频继续回看素材，分析和仿写都围绕这一条视频展开。
              </p>
            ) : null}
          </div>

          {!compact ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/60 bg-card/82 px-3 py-3 shadow-sm">
                <span className="text-2xs uppercase tracking-[0.18em] text-muted-foreground/70">
                  播放
                </span>
                <p className="mt-1 text-sm font-semibold text-foreground/95">
                  {formatNumber(video.playCount)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/82 px-3 py-3 shadow-sm">
                <span className="text-2xs uppercase tracking-[0.18em] text-muted-foreground/70">
                  点赞
                </span>
                <p className="mt-1 text-sm font-semibold text-foreground/95">
                  {formatNumber(video.likeCount)}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {video.tags.slice(0, compact ? 2 : 4).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          {!compact ? (
            <div className="rounded-2xl border border-border/60 bg-background/80 px-3 py-2.5 text-xs text-muted-foreground/75 shadow-sm">
              <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Source</p>
              <p className="mt-1 truncate">{buildSourceLabel(video)}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
});

export const AiWorkspaceVideoPane = memo(AiWorkspaceVideoPaneInner);
