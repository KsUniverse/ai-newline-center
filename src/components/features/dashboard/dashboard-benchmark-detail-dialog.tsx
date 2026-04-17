"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AiWorkspaceShell,
  BenchmarkDetailHeader,
  BenchmarkSurfaceSection,
  BenchmarkVideoList,
} from "@/components/features/benchmarks";
import type { AiWorkspaceTransitionOrigin } from "@/components/features/benchmarks/ai-workspace-transition";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, dashboardApi } from "@/lib/api-client";
import type {
  BenchmarkAccountDetailDTO,
  DouyinVideoDTO,
} from "@/types/douyin-account";

interface DashboardBenchmarkDetailDialogProps {
  accountId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

const VIDEOS_PER_PAGE = 20;

export function DashboardBenchmarkDetailDialog({
  accountId,
  open,
  onOpenChange,
}: DashboardBenchmarkDetailDialogProps) {
  const [account, setAccount] = useState<BenchmarkAccountDetailDTO | null>(null);
  const [videos, setVideos] = useState<DouyinVideoDTO[]>([]);
  const [videosTotal, setVideosTotal] = useState(0);
  const [videoPage, setVideoPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [videosLoading, setVideosLoading] = useState(false);
  const [workspaceLauncher, setWorkspaceLauncher] = useState<WorkspaceLauncherState>(
    INITIAL_WORKSPACE_LAUNCHER_STATE,
  );

  useEffect(() => {
    if (!open || !accountId) {
      setAccount(null);
      setVideos([]);
      setVideosTotal(0);
      setVideoPage(1);
      return;
    }

    let cancelled = false;
    const currentAccountId = accountId;

    async function loadAccount() {
      setLoading(true);
      try {
        const result = await dashboardApi.getBenchmarkAccountDetail(currentAccountId);
        if (!cancelled) {
          setAccount(result);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof ApiError ? error.message : "加载博主详情失败，请稍后重试。";
          toast.error(message);
          onOpenChange(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAccount();

    return () => {
      cancelled = true;
    };
  }, [accountId, onOpenChange, open]);

  useEffect(() => {
    if (!open || !accountId) {
      return;
    }

    let cancelled = false;
    const currentAccountId = accountId;

    async function loadVideos() {
      setVideosLoading(true);
      try {
        const result = await dashboardApi.getBenchmarkAccountVideos(currentAccountId, {
          page: videoPage,
          limit: VIDEOS_PER_PAGE,
        });
        if (!cancelled) {
          setVideos(result.items);
          setVideosTotal(result.total);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof ApiError ? error.message : "加载博主样本失败，请稍后重试。";
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setVideosLoading(false);
        }
      }
    }

    void loadVideos();

    return () => {
      cancelled = true;
    };
  }, [accountId, open, videoPage]);

  const handleOpenWorkspace = async (
    video: DouyinVideoDTO,
    originRect: AiWorkspaceTransitionOrigin,
  ) => {
    try {
      const fullVideo = await dashboardApi.getBenchmarkVideo(video.id);
      setWorkspaceLauncher({
        video: fullVideo,
        originRect,
        hiddenVideoId: fullVideo.id,
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-6xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border/60 px-6 py-5">
            <DialogTitle>博主详情</DialogTitle>
            <DialogDescription>
              在仪表盘内快速查看研究对象资料与作品样本，不离开当前工作区。
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(90vh-88px)] space-y-6 overflow-y-auto px-6 py-6">
            {loading || !account ? (
              <div className="h-80 animate-pulse rounded-3xl border border-border/60 bg-card" />
            ) : (
              <BenchmarkDetailHeader account={account} />
            )}

            <BenchmarkSurfaceSection
              eyebrow="Sample Library"
              title="作品样本库"
              description="点击封面继续进入仿写工作台，直接在弹框内串联浏览和创作。"
            >
              <BenchmarkVideoList
                videos={videos}
                total={videosTotal}
                page={videoPage}
                onPageChange={setVideoPage}
                loading={videosLoading}
                activeVideoId={workspaceLauncher.hiddenVideoId}
                onVideoClick={handleOpenWorkspace}
              />
            </BenchmarkSurfaceSection>
          </div>
        </DialogContent>
      </Dialog>

      <AiWorkspaceShell
        video={workspaceLauncher.video}
        originRect={workspaceLauncher.originRect}
        onSourceReveal={handleRevealWorkspaceSource}
        onClose={handleCloseWorkspace}
      />
    </>
  );
}
