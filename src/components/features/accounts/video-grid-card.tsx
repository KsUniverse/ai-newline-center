"use client";

import { useRef, useState } from "react";
import { Film, Heart, MessageCircle } from "lucide-react";

import type { DouyinVideoWithAccountDTO } from "@/types/douyin-account";
import { cn, proxyImageUrl, formatNumber, formatDateTime } from "@/lib/utils";

interface VideoGridCardProps {
  video: DouyinVideoWithAccountDTO;
  onClick: () => void;
}

export function VideoGridCard({ video, onClick }: VideoGridCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isHoverPlaying, setIsHoverPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleMouseEnter = async () => {
    const el = videoRef.current;
    if (!el || !video.videoUrl) return;
    el.currentTime = 0;
    el.muted = true;
    el.volume = 1;
    try {
      await el.play();
      setIsHoverPlaying(true);
      try {
        el.muted = false;
      } catch {
        // stay muted if browser blocks audio
      }
    } catch {
      setIsHoverPlaying(false);
    }
  };

  const handleMouseLeave = () => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setIsHoverPlaying(false);
    setProgress(0);
  };

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    setProgress(el.currentTime / el.duration);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const el = videoRef.current;
    const bar = progressBarRef.current;
    if (!el || !bar || !el.duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * el.duration;
  };

  return (
    <button
      type="button"
      className="group relative aspect-3/4 w-full overflow-hidden rounded-lg border border-border/55 bg-card/90 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
            isHoverPlaying && video.videoUrl ? "opacity-0" : "opacity-100",
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
          loop
          playsInline
          onTimeUpdate={handleTimeUpdate}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            isHoverPlaying ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="flex flex-wrap gap-1.5">
          {video.accountNickname ? (
            <span className="inline-flex items-center rounded-md border border-white/15 bg-black/35 px-2 py-0.5 text-2xs font-medium text-white/85 backdrop-blur-sm">
              {video.accountNickname}
            </span>
          ) : null}
          {video.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-md border border-white/15 bg-black/30 px-2 py-0.5 text-2xs font-medium text-white/75 backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
        </div>

        <span className="inline-flex items-center rounded-md border border-white/15 bg-black/35 px-2 py-0.5 text-2xs font-medium text-white/85 backdrop-blur-sm">
          内容样本
        </span>
      </div>

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

      {isHoverPlaying && (
        <div
          ref={progressBarRef}
          className="absolute inset-x-0 bottom-0 z-20 h-1 cursor-pointer bg-white/25 transition-[height] hover:h-1.5"
          onClick={handleSeek}
        >
          <div className="h-full bg-white" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </button>
  );
}
