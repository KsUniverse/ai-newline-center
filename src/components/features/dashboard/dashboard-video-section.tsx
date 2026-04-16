"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Tag, TrendingUp } from "lucide-react";

import { SurfaceSection } from "@/components/shared/common/surface-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dashboardApi } from "@/lib/api-client";
import {
  BENCHMARK_VIDEO_TAG_LABELS,
  BENCHMARK_VIDEO_TAG_VALUES,
  DATE_RANGE_LABELS,
  formatLikeCount,
  formatRelativeTime,
  type BenchmarkVideoTag,
  type DateRangeToken,
  type DashboardVideoItem,
} from "@/types/benchmark-video";
import { cn } from "@/lib/utils";

export function DashboardVideoSection() {
  const [dateRange, setDateRange] = useState<DateRangeToken>("today");
  const [customTag, setCustomTag] = useState<BenchmarkVideoTag | "">("");
  const [isBringOrder, setIsBringOrder] = useState<"all" | "true" | "false">("all");
  const [items, setItems] = useState<DashboardVideoItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchVideos = useCallback(
    async (cursor?: string) => {
      const params = {
        dateRange,
        ...(customTag ? { customTag: customTag as BenchmarkVideoTag } : {}),
        ...(isBringOrder !== "all" ? { isBringOrder: isBringOrder === "true" } : {}),
        ...(cursor ? { cursor } : {}),
      };

      const result = await dashboardApi.getVideos(params);
      return result;
    },
    [dateRange, customTag, isBringOrder],
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setItems([]);
    setNextCursor(null);
    try {
      const result = await fetchVideos();
      setItems(result.items);
      setNextCursor(result.nextCursor);
      setTotal(result.total);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [fetchVideos]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchVideos(nextCursor);
      setItems((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTagChange = async (videoId: string, newTag: BenchmarkVideoTag | null) => {
    const prevItems = items;
    setItems((prev) =>
      prev.map((item) =>
        item.id === videoId ? { ...item, customTag: newTag } : item,
      ),
    );
    try {
      await dashboardApi.updateVideoTag(videoId, newTag);
    } catch {
      setItems(prevItems);
    }
  };

  const handleBringOrderToggle = async (videoId: string, current: boolean) => {
    const prevItems = items;
    setItems((prev) =>
      prev.map((item) =>
        item.id === videoId ? { ...item, isBringOrder: !current } : item,
      ),
    );
    try {
      await dashboardApi.updateVideoBringOrder(videoId, !current);
    } catch {
      setItems(prevItems);
    }
  };

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {/* 日期 Tab */}
      <div className="flex rounded-lg border border-border/60 bg-muted/40 p-0.5">
        {(Object.keys(DATE_RANGE_LABELS) as DateRangeToken[]).map((key) => (
          <button
            key={key}
            onClick={() => setDateRange(key)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              dateRange === key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {DATE_RANGE_LABELS[key]}
          </button>
        ))}
      </div>

      {/* 标签 Select */}
      <Select value={customTag} onValueChange={(v) => setCustomTag(v as BenchmarkVideoTag | "")}>
        <SelectTrigger className="h-8 w-32 text-sm">
          <SelectValue placeholder="全部标签" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">全部标签</SelectItem>
          {BENCHMARK_VIDEO_TAG_VALUES.map((tag) => (
            <SelectItem key={tag} value={tag}>
              {BENCHMARK_VIDEO_TAG_LABELS[tag]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 带单 Select */}
      <Select
        value={isBringOrder}
        onValueChange={(v) => setIsBringOrder(v as "all" | "true" | "false")}
      >
        <SelectTrigger className="h-8 w-28 text-sm">
          <SelectValue placeholder="全部" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部</SelectItem>
          <SelectItem value="true">带单</SelectItem>
          <SelectItem value="false">不带单</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <SurfaceSection
      eyebrow="Video Monitor"
      title="短视频列表"
      description={loading ? "加载中…" : `共 ${total} 条，按点赞倒序`}
      actions={actions}
    >
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          加载中…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">该时间段暂无视频</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {items.map((video) => (
            <VideoRow
              key={video.id}
              video={video}
              onTagChange={handleTagChange}
              onBringOrderToggle={handleBringOrderToggle}
            />
          ))}
        </div>
      )}

      {nextCursor && !loading && (
        <div className="border-t border-border/40 px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => void handleLoadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? "加载中…" : "加载更多"}
          </Button>
        </div>
      )}
    </SurfaceSection>
  );
}

interface VideoRowProps {
  video: DashboardVideoItem;
  onTagChange: (videoId: string, tag: BenchmarkVideoTag | null) => void;
  onBringOrderToggle: (videoId: string, current: boolean) => void;
}

function VideoRow({ video, onTagChange, onBringOrderToggle }: VideoRowProps) {
  const [coverError, setCoverError] = useState(false);

  return (
    <div className="flex items-start gap-3 px-5 py-3">
      {/* 封面 */}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-muted">
        {video.coverUrl && !coverError ? (
          <Image
            src={video.coverUrl}
            alt={video.title}
            fill
            className="object-cover"
            onError={() => setCoverError(true)}
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Tag className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* 内容 */}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="line-clamp-2 text-sm font-medium leading-5 text-foreground/90">
          {video.title}
        </p>
        <p className="text-xs text-muted-foreground">
          @{video.account.nickname}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            👍 {formatLikeCount(video.likeCount)}
          </span>
          <span className="text-xs text-muted-foreground/60">·</span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(video.publishedAt)}
          </span>
        </div>
      </div>

      {/* 操作区 */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        {/* 自定义标签 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted">
              {video.customTag ? BENCHMARK_VIDEO_TAG_LABELS[video.customTag] : "—"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            {BENCHMARK_VIDEO_TAG_VALUES.map((tag) => (
              <DropdownMenuItem
                key={tag}
                onClick={() => onTagChange(video.id, tag)}
                className={cn(video.customTag === tag && "font-semibold text-primary")}
              >
                {BENCHMARK_VIDEO_TAG_LABELS[tag]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onTagChange(video.id, null)}
              className="text-muted-foreground"
            >
              清除标签
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 带单状态 */}
        <button
          onClick={() => onBringOrderToggle(video.id, video.isBringOrder)}
          className="focus:outline-none"
        >
          <Badge
            className={cn(
              "cursor-pointer text-xs transition-colors",
              video.isBringOrder
                ? "border-transparent bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25"
                : "border-border bg-transparent text-muted-foreground hover:bg-muted",
            )}
          >
            {video.isBringOrder ? "带单" : "无"}
          </Badge>
        </button>
      </div>
    </div>
  );
}
