"use client";

import { useRef, useEffect } from "react";
import { Heart, Film } from "lucide-react";

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
      className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-card cursor-pointer"
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={onClick}
    >
      {/* Cover image */}
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

      {/* Video element (only when videoUrl exists) */}
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

      {/* Tags — top left */}
      {video.tags.length > 0 && (
        <div className="absolute top-2 left-2 flex gap-1">
          {video.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-sm px-2 py-0.5 text-2xs font-medium bg-black/50 text-white/90 backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Bottom gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
        <p className="truncate text-sm font-medium text-white text-left">
          {video.title}
        </p>
        <div className="mt-1 flex items-center justify-between text-sm text-white/80">
          <span className="flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            {formatNumber(video.likeCount)}
          </span>
          <span className="tabular-nums tracking-tight">
            {formatDateTime(video.publishedAt)}
          </span>
        </div>
      </div>
    </button>
  );
}
