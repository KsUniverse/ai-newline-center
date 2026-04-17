"use client";

import { Film } from "lucide-react";

import type { AiWorkspaceTransitionOrigin } from "@/components/features/benchmarks/ai-workspace-transition";
import { type BenchmarkVideoTag, type DashboardVideoItem } from "@/types/benchmark-video";

import { DashboardVideoCard } from "./dashboard-video-card";

interface DashboardVideoGridProps {
  items: DashboardVideoItem[];
  loading: boolean;
  activeVideoId?: string | null;
  onTagChange: (videoId: string, tag: BenchmarkVideoTag | null) => void;
  onBringOrderToggle: (videoId: string, current: boolean) => void;
  onOpenWorkspace: (videoId: string, originRect: AiWorkspaceTransitionOrigin) => void;
  onOpenAccountDetail: (accountId: string) => void;
}

export function DashboardVideoGrid({
  items,
  loading,
  activeVideoId = null,
  onTagChange,
  onBringOrderToggle,
  onOpenWorkspace,
  onOpenAccountDetail,
}: DashboardVideoGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="aspect-3/4 animate-pulse rounded-2xl border border-border/60 bg-card/80"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-background/60 px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-card">
          <Film className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground/90">暂时没有可处理的视频</h3>
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground/80">
          试试切换日期、标签或带单筛选，查看其他时间段的研究样本。
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
      {items.map((video) => (
        <DashboardVideoCard
          key={video.id}
          video={video}
          hidden={activeVideoId === video.id}
          onTagChange={onTagChange}
          onBringOrderToggle={onBringOrderToggle}
          onOpenWorkspace={onOpenWorkspace}
          onOpenAccountDetail={onOpenAccountDetail}
        />
      ))}
    </div>
  );
}
