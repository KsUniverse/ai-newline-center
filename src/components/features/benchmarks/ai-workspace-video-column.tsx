"use client";

import { Clock3, Film, Play } from "lucide-react";

import type { DouyinVideoDTO } from "@/types/douyin-account";
import { cn, formatDateTime, formatNumber, proxyImageUrl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

import { buildSourceLabel } from "./ai-workspace-model";

interface AiWorkspaceVideoColumnProps {
  video: DouyinVideoDTO;
  compact?: boolean;
  onPreview: () => void;
}

export function AiWorkspaceVideoColumn({
  video,
  compact = false,
  onPreview,
}: AiWorkspaceVideoColumnProps) {
  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.08),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.12]" />

      <div className={cn("relative flex min-h-0 flex-1", compact ? "gap-3 p-3" : "flex-col gap-4 p-4")}>
        <button
          type="button"
          onClick={onPreview}
          className={cn(
            "group relative overflow-hidden rounded-2xl border border-border/60 bg-muted",
            compact
              ? "animate-workspace-in-right h-24 w-28 shrink-0 origin-left shadow-lg shadow-primary/8"
              : "aspect-video max-h-[240px] w-full self-start",
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
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/15 to-transparent opacity-90" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-sm">
              <Play className="ml-0.5 h-4 w-4" />
            </span>
          </div>
        </button>

        <div className="relative min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-2xs">
              {video.videoStoragePath ? "可转录" : "待同步"}
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDateTime(video.publishedAt)}
            </span>
          </div>

          <div className="space-y-1.5">
            <h2 className={cn("font-semibold tracking-tight text-foreground/95", compact ? "text-sm" : "text-lg")}>
              {video.title}
            </h2>
          </div>

          {!compact ? (
            <div className="flex items-center gap-5 text-sm text-muted-foreground/80">
              <span>播放 {formatNumber(video.playCount)}</span>
              <span>点赞 {formatNumber(video.likeCount)}</span>
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
            <p className="truncate text-xs text-muted-foreground/75">{buildSourceLabel(video)}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
