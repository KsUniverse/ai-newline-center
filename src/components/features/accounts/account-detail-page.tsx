"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { ApiError, apiClient } from "@/lib/api-client";
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";
import type { PaginatedData } from "@/types/api";
import type { DouyinAccountDetailDTO, DouyinVideoDTO } from "@/types/douyin-account";
import { Button } from "@/components/ui/button";

import { AccountDetailHeader } from "./account-detail-header";
import { AccountReloginDialog } from "./account-relogin-dialog";
import { VideoDetailDialog } from "./video-detail-dialog";
import { VideoList } from "./video-list";

const VIDEOS_PER_PAGE = 20;

export function AccountDetailPageView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [account, setAccount] = useState<DouyinAccountDetailDTO | null>(null);
  const [videos, setVideos] = useState<DouyinVideoDTO[]>([]);
  const [videosTotal, setVideosTotal] = useState(0);
  const [videoPage, setVideoPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<DouyinVideoDTO | null>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [reloginOpen, setReloginOpen] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const hasLoadedAccountRef = useRef(false);
  const hasLoadedVideosRef = useRef(false);
  useAutoRefresh(60_000, () => setRefreshKey((k) => k + 1));

  const accountId = params.id;
  const canRelogin = session?.user?.role === "EMPLOYEE";

  useEffect(() => {
    if (status !== "authenticated" || !accountId) {
      return;
    }

    let cancelled = false;

    async function loadAccount() {
      const shouldShowLoading = !hasLoadedAccountRef.current;
      try {
        if (shouldShowLoading) {
          setLoading(true);
        }
        const result = await apiClient.get<DouyinAccountDetailDTO>(`/douyin-accounts/${accountId}`);
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
    if (status !== "authenticated" || !accountId) {
      return;
    }

    let cancelled = false;

    async function loadVideos() {
      const shouldShowLoading = !hasLoadedVideosRef.current;
      try {
        if (shouldShowLoading) {
          setVideosLoading(true);
        }
        const result = await apiClient.get<PaginatedData<DouyinVideoDTO>>(
          `/douyin-accounts/${accountId}/videos?page=${videoPage}&limit=${VIDEOS_PER_PAGE}`,
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

  function handleSyncSuccess(newLastSyncedAt: string) {
    setAccount((previous) => {
      if (!previous) {
        return previous;
      }

      return { ...previous, lastSyncedAt: newLastSyncedAt };
    });
  }

  function handleVideoClick(video: DouyinVideoDTO) {
    setSelectedVideo(video);
    setVideoDialogOpen(true);
  }

  if (status === "loading") {
    return null;
  }

  if (error && !account) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/accounts")}>
          杩斿洖璐﹀彿鍒楄〃
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
          onClick={() => router.push("/accounts")}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          杩斿洖
        </Button>
      </div>

      <div className="animate-in-up-d1">
        {loading || !account ? (
          <div className="flex items-start gap-5">
            <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ) : (
          <AccountDetailHeader
            account={account}
            canRelogin={canRelogin}
            onSyncSuccess={handleSyncSuccess}
            onReloginOpen={() => setReloginOpen(true)}
          />
        )}
      </div>

      <div className="animate-in-up-d2 min-w-0 space-y-3">
        <div className="min-w-0 flex-1 space-y-3">
          <h3 className="text-lg font-semibold tracking-tight text-foreground/90">瑙嗛鍒楄〃</h3>
          <VideoList
            videos={videos}
            total={videosTotal}
            page={videoPage}
            limit={VIDEOS_PER_PAGE}
            onPageChange={setVideoPage}
            onVideoClick={handleVideoClick}
            loading={videosLoading}
          />
        </div>

      </div>

      <VideoDetailDialog
        video={selectedVideo}
        open={videoDialogOpen}
        onOpenChange={setVideoDialogOpen}
      />

      {account && canRelogin && (
        <AccountReloginDialog
          account={account}
          open={reloginOpen}
          onOpenChange={setReloginOpen}
          onSuccess={() => {
            setReloginOpen(false);
            setRefreshKey((current) => current + 1);
          }}
        />
      )}
    </div>
  );
}

