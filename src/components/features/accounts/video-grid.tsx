"use client";

import { useState } from "react";
import { Film } from "lucide-react";

import type { DouyinVideoWithAccountDTO } from "@/types/douyin-account";
import { getAccountsVideoEmptyDescription } from "./accounts-copy";
import { VideoGridCard } from "./video-grid-card";

interface VideoGridProps {
  videos: DouyinVideoWithAccountDTO[];
  loading: boolean;
  onVideoClick: (video: DouyinVideoWithAccountDTO) => void;
}

export function VideoGrid({ videos, loading, onVideoClick }: VideoGridProps) {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

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
        <h3 className="text-lg font-semibold tracking-tight text-foreground/90">内容样本暂时为空</h3>
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground/80">
          {getAccountsVideoEmptyDescription()}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
      {videos.map((video) => (
        <VideoGridCard
          key={video.id}
          video={video}
          isPlaying={playingVideoId === video.id}
          onHoverStart={() => setPlayingVideoId(video.id)}
          onHoverEnd={() => setPlayingVideoId(null)}
          onClick={() => onVideoClick(video)}
        />
      ))}
    </div>
  );
}
