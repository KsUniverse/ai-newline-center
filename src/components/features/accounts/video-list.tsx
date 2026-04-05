"use client";

import type { DouyinVideoDTO, DouyinVideoWithAccountDTO } from "@/types/douyin-account";
import { PaginationControls } from "@/components/shared/common/pagination-controls";

import { VideoGrid } from "./video-grid";

interface VideoListProps {
  videos: DouyinVideoDTO[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onVideoClick: (video: DouyinVideoDTO) => void;
  loading: boolean;
}

export function VideoList({
  videos,
  total,
  page,
  limit,
  onPageChange,
  onVideoClick,
  loading,
}: VideoListProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-5">
      <VideoGrid
        videos={videos as DouyinVideoWithAccountDTO[]}
        loading={loading}
        onVideoClick={(video) => onVideoClick(video)}
      />
      <PaginationControls page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
