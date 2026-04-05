"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";

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
  const hasLoadedAccountRef = useRef(false);
  const hasLoadedVideosRef = useRef(false);
  useAutoRefresh(60_000, () => setRefreshKey((k) => k + 1));

  const accountId = params.id;
  const currentUserId = session?.user?.id;

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
          const message = error instanceof ApiError ? error.message : "鍔犺浇璐﹀彿淇℃伅澶辫触";
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
          toast.error(error instanceof ApiError ? error.message : "鍔犺浇瑙嗛鍒楄〃澶辫触");
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
        toast.success("已归档");
        router.push("/benchmarks");
      })
      .catch((error: unknown) => {
        toast.error(error instanceof ApiError ? error.message : "褰掓。澶辫触锛岃绋嶅悗閲嶈瘯");
      });
  }

  if (status === "loading") return null;

  if (error && !account) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/benchmarks")}>
          杩斿洖瀵规爣璐﹀彿鍒楄〃
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
          杩斿洖
        </Button>
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
        <h3 className="text-lg font-semibold tracking-tight text-foreground/90">瑙嗛鍒楄〃</h3>
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
            <AlertDialogTitle>纭褰掓。</AlertDialogTitle>
            <AlertDialogDescription>
              褰掓。鍚庯紝璇ュ崥涓荤殑璐﹀彿鍜岃棰戞暟鎹潎淇濈暀浣嗕細浠庝富鍒楄〃闅愯棌銆傜‘璁ゅ綊妗ｏ紵
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>鍙栨秷</AlertDialogCancel>
            <Button variant="destructive" size="sm" onClick={handleConfirmArchive}>
              纭褰掓。
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

