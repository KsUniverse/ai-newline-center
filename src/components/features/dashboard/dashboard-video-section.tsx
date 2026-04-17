"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AiWorkspaceShell } from "@/components/features/benchmarks";
import type { AiWorkspaceTransitionOrigin } from "@/components/features/benchmarks/ai-workspace-transition";
import { SurfaceSection } from "@/components/shared/common/surface-section";
import { Button } from "@/components/ui/button";
import { dashboardApi } from "@/lib/api-client";
import type { DouyinVideoDTO } from "@/types/douyin-account";
import {
  type BenchmarkVideoTag,
  type DateRangeToken,
  type DashboardVideoItem,
} from "@/types/benchmark-video";

import {
  getBringOrderToggleErrorMessage,
  getDashboardVideoSectionDescription,
  getTagUpdateErrorMessage,
  getVideoFetchErrorMessage,
  getVideoLoadMoreErrorMessage,
} from "./dashboard-copy";
import { DashboardBenchmarkDetailDialog } from "./dashboard-benchmark-detail-dialog";
import { DashboardVideoFilterBar } from "./dashboard-video-filter-bar";
import { DashboardVideoGrid } from "./dashboard-video-grid";

interface WorkspaceLauncherState {
  video: DouyinVideoDTO | null;
  originRect: AiWorkspaceTransitionOrigin | null;
  hiddenVideoId: string | null;
}

const INITIAL_WORKSPACE_LAUNCHER_STATE: WorkspaceLauncherState = {
  video: null,
  originRect: null,
  hiddenVideoId: null,
};

export function DashboardVideoSection() {
  const [dateRange, setDateRange] = useState<DateRangeToken>("today");
  const [customTag, setCustomTag] = useState<BenchmarkVideoTag | "ALL">("ALL");
  const [isBringOrder, setIsBringOrder] = useState<"all" | "true" | "false">("all");
  const [items, setItems] = useState<DashboardVideoItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [workspaceLauncher, setWorkspaceLauncher] = useState<WorkspaceLauncherState>(
    INITIAL_WORKSPACE_LAUNCHER_STATE,
  );
  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);

  const fetchVideos = useCallback(
    async (cursor?: string) => {
      const params = {
        dateRange,
        ...(customTag !== "ALL" ? { customTag: customTag as BenchmarkVideoTag } : {}),
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
      toast.error(getVideoFetchErrorMessage());
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
      toast.error(getVideoLoadMoreErrorMessage());
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
      toast.error(getTagUpdateErrorMessage());
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
      toast.error(getBringOrderToggleErrorMessage());
    }
  };

  const handleOpenWorkspace = async (
    videoId: string,
    originRect: AiWorkspaceTransitionOrigin,
  ) => {
    try {
      const video = await dashboardApi.getBenchmarkVideo(videoId);
      setWorkspaceLauncher({
        video,
        originRect,
        hiddenVideoId: video.id,
      });
    } catch {
      toast.error("打开仿写工作台失败，请稍后重试");
    }
  };

  const handleRevealWorkspaceSource = () => {
    setWorkspaceLauncher((current) => ({
      ...current,
      hiddenVideoId: null,
    }));
  };

  const handleCloseWorkspace = () => {
    setWorkspaceLauncher(INITIAL_WORKSPACE_LAUNCHER_STATE);
  };

  const actions = (
    <DashboardVideoFilterBar
      dateRange={dateRange}
      customTag={customTag}
      isBringOrder={isBringOrder}
      onDateRangeChange={setDateRange}
      onCustomTagChange={setCustomTag}
      onBringOrderChange={setIsBringOrder}
    />
  );

  return (
    <SurfaceSection
      eyebrow="Video Monitor"
      title="短视频列表"
      description={getDashboardVideoSectionDescription(loading, total)}
      actions={actions}
      bodyClassName="space-y-5"
    >
      <DashboardVideoGrid
        items={items}
        loading={loading}
        activeVideoId={workspaceLauncher.hiddenVideoId}
        onTagChange={handleTagChange}
        onBringOrderToggle={handleBringOrderToggle}
        onOpenWorkspace={handleOpenWorkspace}
        onOpenAccountDetail={setDetailAccountId}
      />

      {nextCursor && !loading && (
        <div className="border-t border-border/40 pt-5">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => void handleLoadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? "加载中…" : "加载更多"}
          </Button>
        </div>
      )}

      <AiWorkspaceShell
        video={workspaceLauncher.video}
        originRect={workspaceLauncher.originRect}
        onSourceReveal={handleRevealWorkspaceSource}
        onClose={handleCloseWorkspace}
      />
      <DashboardBenchmarkDetailDialog
        accountId={detailAccountId}
        open={detailAccountId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailAccountId(null);
          }
        }}
      />
    </SurfaceSection>
  );
}
