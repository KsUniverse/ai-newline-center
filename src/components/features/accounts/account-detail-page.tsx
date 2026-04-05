"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { ApiError, apiClient } from "@/lib/api-client";
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";
import type { PaginatedData } from "@/types/api";
import type { DouyinAccountDetailDTO, DouyinVideoDTO } from "@/types/douyin-account";
import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { SurfaceSection } from "@/components/shared/common/surface-section";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { Button } from "@/components/ui/button";

import { AccountDetailHeader } from "./account-detail-header";
import { AccountReloginDialog } from "./account-relogin-dialog";
import { VideoDetailDialog } from "./video-detail-dialog";
import { VideoList } from "./video-list";
import {
  ACCOUNTS_BACK_LABEL,
  ACCOUNTS_DETAIL_EYEBROW,
  ACCOUNTS_DETAIL_TITLE,
  ACCOUNTS_VIDEO_SECTION_DESCRIPTION,
  ACCOUNTS_VIDEO_SECTION_TITLE,
  getAccountDetailDescription,
  getAccountLoadErrorMessage,
  getAccountsSyncHint,
  getAccountsVideoCountLabel,
  getAccountVideoLoadErrorMessage,
} from "./accounts-copy";

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
          const message = error instanceof ApiError ? error.message : getAccountLoadErrorMessage();
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
          toast.error(error instanceof ApiError ? error.message : getAccountVideoLoadErrorMessage());
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
      <DashboardPageShell
        eyebrow={ACCOUNTS_DETAIL_EYEBROW}
        title={ACCOUNTS_DETAIL_TITLE}
        description={getAccountDetailDescription(account)}
        backHref="/accounts"
        backLabel={ACCOUNTS_BACK_LABEL}
      >
        <SurfaceSection title="账号档案暂时不可用" description={error}>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 rounded-md px-3 text-sm" onClick={() => router.push("/accounts")}>
              返回账号列表
            </Button>
            <Button variant="ghost" size="sm" className="h-8 rounded-md px-3 text-sm" onClick={() => setRefreshKey((key) => key + 1)}>
              重试加载
            </Button>
          </div>
        </SurfaceSection>
      </DashboardPageShell>
    );
  }

  return (
    <DashboardPageShell
      eyebrow={ACCOUNTS_DETAIL_EYEBROW}
      title={ACCOUNTS_DETAIL_TITLE}
      description={getAccountDetailDescription(account)}
      backHref="/accounts"
      backLabel={ACCOUNTS_BACK_LABEL}
      maxWidth="wide"
      surfaceHeader
    >
      <div className="animate-in-up-d1">
        {loading || !account ? (
          <div className="h-105 animate-pulse rounded-3xl border border-border/60 bg-card" />
        ) : (
          <AccountDetailHeader
            account={account}
            canRelogin={canRelogin}
            onSyncSuccess={handleSyncSuccess}
            onReloginOpen={() => setReloginOpen(true)}
          />
        )}
      </div>

      <div className="animate-in-up-d2 min-w-0">
        <SurfaceSection
          eyebrow="Content Samples"
          title={ACCOUNTS_VIDEO_SECTION_TITLE}
          description={ACCOUNTS_VIDEO_SECTION_DESCRIPTION}
          actions={
            <MetaPillList
              items={[
                { label: getAccountsVideoCountLabel(videosTotal), tone: "primary" },
                { label: getAccountsSyncHint() },
              ]}
            />
          }
        >
          <VideoList
            videos={videos}
            total={videosTotal}
            page={videoPage}
            limit={VIDEOS_PER_PAGE}
            onPageChange={setVideoPage}
            onVideoClick={handleVideoClick}
            loading={videosLoading}
          />
        </SurfaceSection>
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
    </DashboardPageShell>
  );
}

