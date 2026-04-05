"use client";

import { useEffect, useRef } from "react";
import { Film, Heart, MessageCircle, Play } from "lucide-react";

import type { DouyinVideoWithAccountDTO } from "@/types/douyin-account";
import { cn, proxyImageUrl, formatNumber, formatDateTime } from "@/lib/utils";

interface VideoGridCardProps {
  video: DouyinVideoWithAccountDTO;
  isPlaying: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick: () => void;
}

export function VideoGridCard({
  video,
  isPlaying,
  onHoverStart,
  onHoverEnd,
  onClick,
}: VideoGridCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isPlaying) {
      el.play().catch(() => {
        onHoverEnd();
      });
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [isPlaying, onHoverEnd]);

  return (
    <button
      type="button"
      className="group relative aspect-3/4 w-full overflow-hidden rounded-2xl border border-border/60 bg-card/90 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10"
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={onClick}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.16),transparent_34%)]" />

      {video.coverUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={proxyImageUrl(video.coverUrl)}
          alt={video.title}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            isPlaying && video.videoUrl ? "opacity-0" : "opacity-100",
          )}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Film className="h-8 w-8 text-muted-foreground/50" />
        </div>
      )}

      {video.videoUrl && (
        <video
          ref={videoRef}
          src={video.videoUrl}
          muted
          loop
          playsInline
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            isPlaying ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="flex flex-wrap gap-1.5">
          {video.accountNickname ? (
            <span className="inline-flex items-center rounded-full border border-white/15 bg-black/35 px-2 py-0.5 text-2xs font-medium text-white/85 backdrop-blur-sm">
              {video.accountNickname}
            </span>
          ) : null}
          {video.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-2xs font-medium text-white/75 backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
        </div>

        <span className="inline-flex items-center rounded-full border border-white/15 bg-black/35 px-2 py-0.5 text-2xs font-medium text-white/85 backdrop-blur-sm">
          内容样本
        </span>
      </div>

      {video.videoUrl ? (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white shadow-lg backdrop-blur-sm">
            <Play className="ml-0.5 h-4 w-4" />
          </span>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/45 to-transparent p-4 pt-10">
        <p className="line-clamp-2 text-sm font-medium text-white">{video.title}</p>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-white/75">
          <span className="flex min-w-0 items-center gap-1 tabular-nums tracking-tight">
            <Heart className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{formatNumber(video.likeCount)}</span>
          </span>
          <span className="flex min-w-0 items-center gap-1 tabular-nums tracking-tight">
            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{formatNumber(video.commentCount)}</span>
          </span>
          <span className="shrink-0 tabular-nums tracking-tight">
            {formatDateTime(video.publishedAt)}
          </span>
        </div>
      </div>
    </button>
  );
}
