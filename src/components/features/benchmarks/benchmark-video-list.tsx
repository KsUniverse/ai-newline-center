"use client";

import { useState } from "react";
import { Film } from "lucide-react";

import type { DouyinVideoDTO } from "@/types/douyin-account";

import { getBenchmarkVideoEmptyDescription } from "./benchmark-copy";
import { BenchmarkPagination } from "./benchmark-pagination";
import { BenchmarkVideoGridCard } from "./benchmark-video-grid-card";

const LIMIT = 20;

interface BenchmarkVideoListProps {
  videos: DouyinVideoDTO[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  onVideoClick?: (video: DouyinVideoDTO) => void;
}

export function BenchmarkVideoList({
  videos,
  total,
  page,
  onPageChange,
  loading = false,
  onVideoClick,
}: BenchmarkVideoListProps) {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="aspect-3/4 animate-pulse rounded-2xl border border-border/60 bg-card"
          />
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-background/60 px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-card">
          <Film className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground/90">作品样本同步中</h3>
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground/80">
          {getBenchmarkVideoEmptyDescription()}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
        {videos.map((video) => (
          <BenchmarkVideoGridCard
            key={video.id}
            video={video}
            isPlaying={playingVideoId === video.id}
            onHoverStart={() => setPlayingVideoId(video.id)}
            onHoverEnd={() => setPlayingVideoId(null)}
            onClick={() => onVideoClick?.(video)}
          />
        ))}
      </div>

      <BenchmarkPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
