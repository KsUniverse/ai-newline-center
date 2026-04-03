"use client";

import { useState, useCallback } from "react";
import { Film } from "lucide-react";

import type { DouyinVideoWithAccountDTO } from "@/types/douyin-account";
import { VideoGridCard } from "./video-grid-card";

interface VideoGridProps {
  videos: DouyinVideoWithAccountDTO[];
  loading: boolean;
  onVideoClick: (video: DouyinVideoWithAccountDTO) => void;
}

export function VideoGrid({ videos, loading, onVideoClick }: VideoGridProps) {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

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
        <h3 className="text-lg font-semibold tracking-tight text-foreground/90">
          暂无视频
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground/80 max-w-sm">
          当前筛选条件下没有视频，尝试更换筛选条件
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {videos.map((video) => (
        <VideoGridCard
          key={video.id}
          video={video}
          isPlaying={playingVideoId === video.id}
          onHoverStart={() => handleHoverStart(video.id)}
          onHoverEnd={handleHoverEnd}
          onClick={() => onVideoClick(video)}
        />
      ))}
    </div>
  );
}
