"use client";

import { forwardRef, memo, useCallback, useRef, useState } from "react";
import { Clock3, Film, VolumeX } from "lucide-react";

import type { DouyinVideoDTO } from "@/types/douyin-account";
import { cn, formatDateTime, formatNumber, proxyImageUrl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface AiWorkspaceVideoPaneProps {
  video: DouyinVideoDTO;
  compact?: boolean;
  matchCardRatio?: boolean;
  onPreview?: () => void;
}

const AiWorkspaceVideoPaneInner = forwardRef<HTMLDivElement, AiWorkspaceVideoPaneProps>(function AiWorkspaceVideoPaneInner({
  video,
  compact = false,
  matchCardRatio = false,
}, previewRef) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isHoverPlaying, setIsHoverPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1
  const [duration, setDuration] = useState(0);

  const handleMouseEnter = useCallback(async () => {
    if (!video.videoUrl) return;
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    // Strategy: always start muted (guaranteed to work), then immediately try to unmute.
    // If the browser has seen a user gesture, unmute succeeds. Otherwise show the muted indicator.
    el.muted = true;
    el.volume = 1;
    try {
      await el.play();
      setIsHoverPlaying(true);
      // Attempt to unmute now that play() has resolved
      try {
        el.muted = false;
        setIsMuted(false);
      } catch {
        setIsMuted(true);
      }
    } catch {
      // Completely blocked (e.g. data-saver mode) — stay on cover
    }
  }, [video.videoUrl]);

  const handleMouseLeave = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setIsHoverPlaying(false);
    setIsMuted(false);
    setProgress(0);
  }, []);

  const handleUnmute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    setIsMuted(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    setProgress(el.currentTime / el.duration);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    setDuration(el.duration);
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const bar = progressBarRef.current;
    const el = videoRef.current;
    if (!bar || !el || !el.duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * el.duration;
    setProgress(ratio);
  }, []);

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
        <div
          ref={previewRef}
          className={cn(
            "group relative overflow-hidden border border-border/60 bg-muted shadow-sm transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            compact
              ? "aspect-9/16 w-24 shrink-0 rounded-2xl"
              : matchCardRatio
                ? "aspect-9/16 w-full max-w-72 self-start rounded-[26px] hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/10"
                : "aspect-video w-full rounded-3xl hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/10",
          )}
          onMouseEnter={() => void handleMouseEnter()}
          onMouseLeave={handleMouseLeave}
        >
          {video.coverUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={proxyImageUrl(video.coverUrl)}
              alt={video.title}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-all duration-500",
                isHoverPlaying && video.videoUrl
                  ? "scale-[1.02] opacity-0"
                  : "scale-100 opacity-100 group-hover:scale-[1.03]",
              )}
            />
          ) : (
            <div className="absolute inset-0 flex h-full w-full items-center justify-center text-muted-foreground">
              <Film className="h-8 w-8" />
            </div>
          )}
          {video.videoUrl ? (
            <video
              ref={videoRef}
              src={video.videoUrl}
              loop
              playsInline
              preload="metadata"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                isHoverPlaying ? "opacity-100" : "opacity-0",
              )}
            />
          ) : null}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/18 to-transparent" />

          {/* Progress bar — visible while playing */}
          {isHoverPlaying ? (
            <div className="absolute inset-x-0 bottom-0 px-2 pb-2">
              <div
                ref={progressBarRef}
                role="slider"
                aria-label="视频进度"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={0}
                className="group/bar relative h-1 w-full cursor-pointer rounded-full bg-white/25 transition-all duration-150 hover:h-1.5"
                onClick={handleSeek}
                onKeyDown={(e) => {
                  const el = videoRef.current;
                  if (!el || !el.duration) return;
                  if (e.key === "ArrowRight") { el.currentTime = Math.min(el.duration, el.currentTime + 5); }
                  if (e.key === "ArrowLeft") { el.currentTime = Math.max(0, el.currentTime - 5); }
                }}
              >
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-100"
                  style={{ width: `${progress * 100}%` }}
                />
                {/* Scrubber thumb */}
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-y-1/2 scale-0 rounded-full bg-white shadow transition-transform duration-150 group-hover/bar:scale-100"
                  style={{ left: `calc(${progress * 100}% - 6px)` }}
                />
              </div>
              {/* Time display */}
              {duration > 0 ? (
                <div className="mt-1 flex justify-between px-0.5 text-[10px] tabular-nums text-white/70">
                  <span>{formatVideoTime(progress * duration)}</span>
                  <span>{formatVideoTime(duration)}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Muted indicator — click to unmute after browser unblocks audio */}
          {isHoverPlaying && isMuted ? (
            <button
              type="button"
              aria-label="点击解除静音"
              onClick={handleUnmute}
              className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur-sm transition-opacity hover:bg-black/70"
            >
              <VolumeX className="h-3 w-3" />
              <span>静音中</span>
            </button>
          ) : null}
        </div>

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
        </div>
      </div>
    </section>
  );
});

export const AiWorkspaceVideoPane = memo(AiWorkspaceVideoPaneInner);

function formatVideoTime(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}
