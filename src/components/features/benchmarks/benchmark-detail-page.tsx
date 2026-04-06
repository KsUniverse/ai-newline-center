"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";

import type { PaginatedData } from "@/types/api";
import type { BenchmarkAccountDetailDTO, DouyinVideoDTO } from "@/types/douyin-account";
import { ApiError, apiClient } from "@/lib/api-client";
import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { Button } from "@/components/ui/button";

import { BenchmarkArchiveDialog } from "./benchmark-archive-dialog";
import { BenchmarkDetailHeader } from "./benchmark-detail-header";
import { BenchmarkSurfaceSection } from "./benchmark-surface-section";
import { BenchmarkVideoList } from "./benchmark-video-list";
import { AiWorkspaceShell } from "./ai-workspace-shell";
import type { AiWorkspaceTransitionOrigin } from "./ai-workspace-transition";
import {
  BENCHMARK_BACK_TO_LIBRARY_LABEL,
  BENCHMARK_DETAIL_DESCRIPTION,
  BENCHMARK_DETAIL_EYEBROW,
  BENCHMARK_DETAIL_TITLE,
  BENCHMARK_VIDEO_SECTION_DESCRIPTION,
  BENCHMARK_VIDEO_SECTION_TITLE,
  getBenchmarkArchiveErrorMessage,
  getBenchmarkArchiveSuccessMessage,
  getBenchmarkDetailLoadErrorMessage,
  getBenchmarkLibrarySyncHint,
  getBenchmarkVideoCountLabel,
  getBenchmarkVideoLoadErrorMessage,
} from "./benchmark-copy";

const VIDEOS_PER_PAGE = 20;

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

export function BenchmarkDetailPageView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { status } = useSession();

  const [account, setAccount] = useState<BenchmarkAccountDetailDTO | null>(null);
  const [videos, setVideos] = useState<DouyinVideoDTO[]>([]);
  const [videosTotal, setVideosTotal] = useState(0);
  const [videoPage, setVideoPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(true);
  const [error, setError] = useState("");
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [workspaceLauncher, setWorkspaceLauncher] = useState<WorkspaceLauncherState>(
    INITIAL_WORKSPACE_LAUNCHER_STATE,
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const hasLoadedAccountRef = useRef(false);
  const hasLoadedVideosRef = useRef(false);
  useAutoRefresh(60_000, () => setRefreshKey((k) => k + 1));

  const accountId = params.id;

  useEffect(() => {
    if (status !== "authenticated" || !accountId) return;

    let cancelled = false;

    async function loadAccount() {
      const shouldShowLoading = !hasLoadedAccountRef.current;
      try {
        if (shouldShowLoading) {
          setLoading(true);
        }
        const result = await apiClient.get<BenchmarkAccountDetailDTO>(
          `/benchmarks/${accountId}`,
        );
        if (!cancelled) {
          setAccount(result);
          setError("");
          hasLoadedAccountRef.current = true;
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof ApiError ? error.message : getBenchmarkDetailLoadErrorMessage();
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled && shouldShowLoading) {
          setLoading(false);
        }
      }
    }

    void loadAccount();
    return () => {
      cancelled = true;
    };
  }, [status, accountId, refreshKey]);

  useEffect(() => {
    if (status !== "authenticated" || !accountId) return;

    let cancelled = false;

    async function loadVideos() {
      const shouldShowLoading = !hasLoadedVideosRef.current;
      try {
        if (shouldShowLoading) {
          setVideosLoading(true);
        }
        const result = await apiClient.get<PaginatedData<DouyinVideoDTO>>(
          `/benchmarks/${accountId}/videos?page=${videoPage}&limit=${VIDEOS_PER_PAGE}`,
        );
        if (!cancelled) {
          setVideos(result.items);
          setVideosTotal(result.total);
          hasLoadedVideosRef.current = true;
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.message : getBenchmarkVideoLoadErrorMessage());
        }
      } finally {
        if (!cancelled && shouldShowLoading) {
          setVideosLoading(false);
        }
      }
    }

    void loadVideos();
    return () => {
      cancelled = true;
    };
  }, [status, accountId, videoPage, refreshKey]);

  function handleConfirmArchive() {
    if (!accountId) return;
    setArchiveDialogOpen(false);

    apiClient
      .del(`/benchmarks/${accountId}`)
      .then(() => {
        toast.success(getBenchmarkArchiveSuccessMessage());
        router.push("/benchmarks");
      })
      .catch((error: unknown) => {
        toast.error(getBenchmarkArchiveErrorMessage(error));
      });
  }

  function handleOpenWorkspace(video: DouyinVideoDTO, originRect: AiWorkspaceTransitionOrigin) {
    setWorkspaceLauncher({
      video,
      originRect,
      hiddenVideoId: video.id,
    });
  }

  function handleRevealWorkspaceSource() {
    setWorkspaceLauncher((current) => ({
      ...current,
      hiddenVideoId: null,
    }));
  }

  function handleCloseWorkspace() {
    setWorkspaceLauncher(INITIAL_WORKSPACE_LAUNCHER_STATE);
  }

  if (status === "loading") return null;

  if (error && !account) {
    return (
      <DashboardPageShell
        eyebrow={BENCHMARK_DETAIL_EYEBROW}
        title={BENCHMARK_DETAIL_TITLE}
        description={BENCHMARK_DETAIL_DESCRIPTION}
        backHref="/benchmarks"
        backLabel={BENCHMARK_BACK_TO_LIBRARY_LABEL}
      >
        <BenchmarkSurfaceSection title="档案暂时不可用" description={error}>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 rounded-md px-3 text-sm" onClick={() => router.push("/benchmarks")}>
              返回研究库
            </Button>
            <Button variant="ghost" size="sm" className="h-8 rounded-md px-3 text-sm" onClick={() => setRefreshKey((key) => key + 1)}>
              重试加载
            </Button>
          </div>
        </BenchmarkSurfaceSection>
      </DashboardPageShell>
    );
  }

  return (
    <DashboardPageShell
      eyebrow={BENCHMARK_DETAIL_EYEBROW}
      title={BENCHMARK_DETAIL_TITLE}
      description={BENCHMARK_DETAIL_DESCRIPTION}
      backHref="/benchmarks"
      backLabel={BENCHMARK_BACK_TO_LIBRARY_LABEL}
      maxWidth="wide"
    >
      <div className="animate-in-up-d1">
        {loading || !account ? (
          <div className="h-105 animate-pulse rounded-3xl border border-border/60 bg-card" />
        ) : (
          <BenchmarkDetailHeader
            account={account}
            onArchive={account.canArchive ? () => setArchiveDialogOpen(true) : undefined}
          />
        )}
      </div>

      <div className="animate-in-up-d2">
        <BenchmarkSurfaceSection
          eyebrow="Sample Library"
          title={BENCHMARK_VIDEO_SECTION_TITLE}
          description={BENCHMARK_VIDEO_SECTION_DESCRIPTION}
          actions={
            <MetaPillList
              items={[
                { label: getBenchmarkVideoCountLabel(videosTotal), tone: "primary" },
                { label: getBenchmarkLibrarySyncHint() },
              ]}
            />
          }
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

      <BenchmarkArchiveDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        onConfirm={handleConfirmArchive}
        nickname={account?.nickname}
      />
      <AiWorkspaceShell
        video={workspaceLauncher.video}
        originRect={workspaceLauncher.originRect}
        onSourceReveal={handleRevealWorkspaceSource}
        onClose={handleCloseWorkspace}
      />
    </DashboardPageShell>
  );
}

