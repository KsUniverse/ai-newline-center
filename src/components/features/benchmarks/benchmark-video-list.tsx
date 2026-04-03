"use client";

import { useState, useCallback } from "react";
import { Film, ChevronLeft, ChevronRight } from "lucide-react";

import type { DouyinVideoDTO } from "@/types/douyin-account";
import { Button } from "@/components/ui/button";
import { BenchmarkVideoGridCard } from "./benchmark-video-grid-card";

const LIMIT = 20;

interface BenchmarkVideoListProps {
  videos: DouyinVideoDTO[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function BenchmarkVideoList({
  videos,
  total,
  page,
  onPageChange,
  loading = false,
}: BenchmarkVideoListProps) {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const handleHoverStart = useCallback((videoId: string) => {
    setPlayingVideoId(videoId);
  }, []);

  const handleHoverEnd = useCallback(() => {
    setPlayingVideoId(null);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[3/4] rounded-lg bg-card animate-pulse border border-border/60"
          />
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-4">
          <Film className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground/90">暂无视频</h3>
        <p className="mt-1.5 text-sm text-muted-foreground/80 max-w-sm">
          账号信息正在同步中，视频数据稍后会自动更新
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {videos.map((video) => (
          <BenchmarkVideoGridCard
            key={video.id}
            video={video}
            isPlaying={playingVideoId === video.id}
            onHoverStart={() => handleHoverStart(video.id)}
            onHoverEnd={handleHoverEnd}
            onClick={() => {}}
          />
        ))}
      </div>

      {total > LIMIT && (
        <div className="flex items-center justify-center gap-4 pb-4">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            下一页
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
