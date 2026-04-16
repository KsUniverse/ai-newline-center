"use client";

import { Film, Heart } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, proxyImageUrl } from "@/lib/utils";
import {
  BENCHMARK_VIDEO_TAG_LABELS,
  BENCHMARK_VIDEO_TAG_VALUES,
  formatLikeCount,
  formatRelativeTime,
  type BenchmarkVideoTag,
  type DashboardVideoItem,
} from "@/types/benchmark-video";

import { getBringOrderTone, getVideoTagTone } from "./dashboard-copy";

interface DashboardVideoCardProps {
  video: DashboardVideoItem;
  onTagChange: (videoId: string, tag: BenchmarkVideoTag | null) => void;
  onBringOrderToggle: (videoId: string, current: boolean) => void;
}

const TAG_TONE_CLASS = {
  primary: "border-primary/20 bg-primary/15 text-primary",
  muted: "border-white/15 bg-black/35 text-white/78",
} as const;

const BRING_ORDER_TONE_CLASS = {
  success: "border-emerald-400/20 bg-emerald-500/15 text-emerald-100",
  muted: "border-white/15 bg-black/35 text-white/78",
} as const;

export function DashboardVideoCard({
  video,
  onTagChange,
  onBringOrderToggle,
}: DashboardVideoCardProps) {
  const tagTone = getVideoTagTone(video.customTag);
  const bringOrderTone = getBringOrderTone(video.isBringOrder);

  return (
    <article className="group relative aspect-3/4 overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.16),transparent_34%)]" />

      {video.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxyImageUrl(video.coverUrl)}
          alt={video.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Film className="h-8 w-8 text-muted-foreground/50" />
        </div>
      )}

      <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/45 to-transparent" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex max-w-[70%] items-center rounded-full border px-2.5 py-1 text-2xs font-medium backdrop-blur-sm transition-colors hover:border-white/30",
                TAG_TONE_CLASS[tagTone],
              )}
            >
              <span className="truncate">
                {video.customTag ? BENCHMARK_VIDEO_TAG_LABELS[video.customTag] : "未标记"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            {BENCHMARK_VIDEO_TAG_VALUES.map((tag) => (
              <DropdownMenuItem key={tag} onClick={() => onTagChange(video.id, tag)}>
                {BENCHMARK_VIDEO_TAG_LABELS[tag]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onTagChange(video.id, null)}>
              清除标签
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={() => onBringOrderToggle(video.id, video.isBringOrder)}
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1 text-2xs font-medium backdrop-blur-sm transition-colors hover:border-white/30",
            BRING_ORDER_TONE_CLASS[bringOrderTone],
          )}
        >
          {video.isBringOrder ? "带单" : "未带单"}
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4 pt-12">
        <div className="mb-2 inline-flex max-w-full items-center rounded-full border border-white/15 bg-black/25 px-2.5 py-1 text-2xs text-white/80 backdrop-blur-sm">
          <span className="truncate">@{video.account.nickname}</span>
        </div>

        <p className="line-clamp-2 text-sm font-medium leading-6 text-white">
          {video.title}
        </p>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-white/75">
          <span className="flex min-w-0 items-center gap-1 tabular-nums tracking-tight">
            <Heart className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{formatLikeCount(video.likeCount)}</span>
          </span>
          <span className="truncate text-right tabular-nums tracking-tight">
            {formatRelativeTime(video.publishedAt)}
          </span>
        </div>
      </div>
    </article>
  );
}
