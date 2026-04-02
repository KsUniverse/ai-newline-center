"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import type { DouyinAccountDetailDTO, DouyinVideoDTO } from "@/types/douyin-account";
import type { PaginatedData } from "@/types/api";
import { AccountDetailHeader } from "@/components/features/accounts/account-detail-header";
import { VideoList } from "@/components/features/accounts/video-list";
import { VideoDetailDialog } from "@/components/features/accounts/video-detail-dialog";
import { Button } from "@/components/ui/button";
import { apiClient, ApiError } from "@/lib/api-client";

const VIDEOS_PER_PAGE = 20;

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { status } = useSession();

  const [account, setAccount] = useState<DouyinAccountDetailDTO | null>(null);
  const [videos, setVideos] = useState<DouyinVideoDTO[]>([]);
  const [videosTotal, setVideosTotal] = useState(0);
  const [videoPage, setVideoPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<DouyinVideoDTO | null>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [error, setError] = useState("");

  const accountId = params.id;

  useEffect(() => {
    if (status !== "authenticated" || !accountId) return;

    let cancelled = false;

    async function loadAccount() {
      try {
        setLoading(true);
        const result = await apiClient.get<DouyinAccountDetailDTO>(
          `/douyin-accounts/${accountId}`,
        );
        if (!cancelled) {
          setAccount(result);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof ApiError ? err.message : "加载账号信息失败";
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
  }, [status, accountId]);

  useEffect(() => {
    if (status !== "authenticated" || !accountId) return;

    let cancelled = false;

    async function loadVideos() {
      try {
        setVideosLoading(true);
        const result = await apiClient.get<PaginatedData<DouyinVideoDTO>>(
          `/douyin-accounts/${accountId}/videos?page=${videoPage}&limit=${VIDEOS_PER_PAGE}`,
        );
        if (!cancelled) {
          setVideos(result.items);
          setVideosTotal(result.total);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof ApiError ? err.message : "加载视频列表失败";
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
  }, [status, accountId, videoPage]);

  if (status === "loading") {
    return null;
  }

  function handleVideoClick(video: DouyinVideoDTO) {
    setSelectedVideo(video);
    setVideoDialogOpen(true);
  }

  if (error && !account) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/accounts")}>
          返回账号列表
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-6 max-w-6xl mx-auto w-full">
      {/* Back button */}
      <div className="animate-in-up">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => router.push("/accounts")}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          返回
        </Button>
      </div>

      {/* Account header */}
      <div className="animate-in-up-d1">
        {loading || !account ? (
          <div className="flex items-start gap-5">
            <div className="h-16 w-16 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-32 rounded bg-muted animate-pulse" />
              <div className="h-4 w-48 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ) : (
          <AccountDetailHeader account={account} />
        )}
      </div>

      {/* Videos section */}
      <div className="animate-in-up-d2 space-y-3">
        <h3 className="text-lg font-semibold tracking-tight text-foreground/90">
          视频列表
        </h3>
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

      {/* Video detail dialog */}
      <VideoDetailDialog
        video={selectedVideo}
        open={videoDialogOpen}
        onOpenChange={setVideoDialogOpen}
      />
    </div>
  );
}
