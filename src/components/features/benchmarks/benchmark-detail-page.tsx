"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { PaginatedData } from "@/types/api";
import type { BenchmarkAccountDetailDTO, DouyinVideoDTO } from "@/types/douyin-account";
import { ApiError, apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { BenchmarkDetailHeader } from "./benchmark-detail-header";
import { BenchmarkVideoList } from "./benchmark-video-list";
import { BenchmarkVideoDetailPanel } from "./benchmark-video-detail-panel";

const VIDEOS_PER_PAGE = 20;

export function BenchmarkDetailPageView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [account, setAccount] = useState<BenchmarkAccountDetailDTO | null>(null);
  const [videos, setVideos] = useState<DouyinVideoDTO[]>([]);
  const [videosTotal, setVideosTotal] = useState(0);
  const [videoPage, setVideoPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(true);
  const [error, setError] = useState("");
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<DouyinVideoDTO | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { isRefreshing } = useAutoRefresh(60_000, () => setRefreshKey((k) => k + 1));

  const accountId = params.id;
  const currentUserId = session?.user?.id;

  useEffect(() => {
    if (status !== "authenticated" || !accountId) return;

    let cancelled = false;

    async function loadAccount() {
      try {
        setLoading(true);
        const result = await apiClient.get<BenchmarkAccountDetailDTO>(
          `/benchmarks/${accountId}`,
        );
        if (!cancelled) {
          setAccount(result);
          setError("");
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof ApiError ? error.message : "加载账号信息失败";
          setError(message);
          toast.error(message);
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
  }, [status, accountId, refreshKey]);

  useEffect(() => {
    if (status !== "authenticated" || !accountId) return;

    let cancelled = false;

    async function loadVideos() {
      try {
        setVideosLoading(true);
        const result = await apiClient.get<PaginatedData<DouyinVideoDTO>>(
          `/benchmarks/${accountId}/videos?page=${videoPage}&limit=${VIDEOS_PER_PAGE}`,
        );
        if (!cancelled) {
          setVideos(result.items);
          setVideosTotal(result.total);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.message : "加载视频列表失败");
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
  }, [status, accountId, videoPage, refreshKey]);

  function handleConfirmArchive() {
    if (!accountId) return;
    setArchiveDialogOpen(false);

    apiClient
      .del(`/benchmarks/${accountId}`)
      .then(() => {
        toast.success("已归档");
        router.push("/benchmarks");
      })
      .catch((error: unknown) => {
        toast.error(error instanceof ApiError ? error.message : "归档失败，请稍后重试");
      });
  }

  if (status === "loading") return null;

  if (error && !account) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/benchmarks")}>
          返回对标账号列表
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-6 max-w-6xl mx-auto w-full">
      <div className="animate-in-up flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => router.push("/benchmarks")}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          返回
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground/50 shrink-0",
                  isRefreshing && "animate-spin",
                )}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>每 60 秒自动刷新</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="animate-in-up-d1">
        {loading || !account ? (
          <div className="flex items-start gap-5">
            <div className="h-20 w-20 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-40 animate-pulse rounded bg-muted" />
              <div className="h-4 w-56 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ) : (
          <BenchmarkDetailHeader
            account={account}
            currentUserId={currentUserId}
            onArchive={() => setArchiveDialogOpen(true)}
          />
        )}
      </div>

      <div className="animate-in-up-d2 space-y-3">
        <h3 className="text-lg font-semibold tracking-tight text-foreground/90">视频列表</h3>
        <BenchmarkVideoList
          videos={videos}
          total={videosTotal}
          page={videoPage}
          onPageChange={setVideoPage}
          loading={videosLoading}
          onVideoClick={(video) => setSelectedVideo(video)}
        />
      </div>

      <AlertDialog
        open={archiveDialogOpen}
        onOpenChange={(open) => {
          if (!open) setArchiveDialogOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认归档</AlertDialogTitle>
            <AlertDialogDescription>
              归档后，该博主的账号和视频数据均保留但会从主列表隐藏。确认归档？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <Button variant="destructive" size="sm" onClick={handleConfirmArchive}>
              确认归档
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <BenchmarkVideoDetailPanel
        video={selectedVideo}
        onClose={() => setSelectedVideo(null)}
      />
    </div>
  );
}
