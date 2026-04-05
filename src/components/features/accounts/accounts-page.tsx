"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";

import type { PaginatedData } from "@/types/api";
import type { DouyinAccountDTO, DouyinVideoWithAccountDTO } from "@/types/douyin-account";
import { ApiError, apiClient } from "@/lib/api-client";
import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { PaginationControls } from "@/components/shared/common/pagination-controls";
import { SurfaceSection } from "@/components/shared/common/surface-section";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { Button } from "@/components/ui/button";

import { AccountAddDrawer } from "./account-add-drawer";
import { AccountCardGrid } from "./account-card-grid";
import { AccountEmptyState } from "./account-empty-state";
import { VideoDetailDialog } from "./video-detail-dialog";
import { VideoFilterBar } from "./video-filter-bar";
import { VideoGrid } from "./video-grid";
import {
  ACCOUNTS_ADD_ACTION_LABEL,
  ACCOUNTS_EYEBROW,
  ACCOUNTS_VIDEO_SECTION_DESCRIPTION,
  ACCOUNTS_VIDEO_SECTION_TITLE,
  getAccountsCountLabel,
  getAccountsFilterSummary,
  getAccountsLibrarySectionDescription,
  getAccountsLibrarySectionTitle,
  getAccountsListLoadErrorMessage,
  getAccountsPageMeta,
  getAccountsSyncHint,
  getAccountsVideoCountLabel,
  getAccountsVideoFeedLoadErrorMessage,
} from "./accounts-copy";

const VIDEOS_PER_PAGE = 20;

export function AccountsPageView() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [accounts, setAccounts] = useState<DouyinAccountDTO[]>([]);
  const [videos, setVideos] = useState<DouyinVideoWithAccountDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<DouyinVideoWithAccountDTO | null>(null);
  const [page, setPage] = useState(1);
  const [filterAccountId, setFilterAccountId] = useState<string | undefined>();
  const [filterTag, setFilterTag] = useState<string | undefined>();
  const [sort, setSort] = useState<"publishedAt" | "likeCount">("publishedAt");
  const hasLoadedAccountsRef = useRef(false);
  const hasLoadedVideosRef = useRef(false);

  const userRole = session?.user?.role ?? "EMPLOYEE";
  const isEmployee = userRole === "EMPLOYEE";
  const { title, description } = getAccountsPageMeta(userRole);
  const totalPages = Math.max(1, Math.ceil(total / VIDEOS_PER_PAGE));

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    videos.forEach((video) => video.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [videos]);

  useAutoRefresh(60_000, () => setRefreshKey((current) => current + 1));

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;

    async function loadAccounts() {
      const shouldShowLoading = !hasLoadedAccountsRef.current;
      try {
        if (shouldShowLoading) {
          setAccountsLoading(true);
        }
        const result = await apiClient.get<PaginatedData<DouyinAccountDTO>>("/douyin-accounts?page=1&limit=100");
        if (!cancelled) {
          setAccounts(result.items);
          hasLoadedAccountsRef.current = true;
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.message : getAccountsListLoadErrorMessage());
        }
      } finally {
        if (!cancelled && shouldShowLoading) {
          setAccountsLoading(false);
        }
      }
    }

    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [status, refreshKey]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;

    async function loadVideos() {
      const shouldShowLoading = !hasLoadedVideosRef.current;
      try {
        if (shouldShowLoading) {
          setVideosLoading(true);
        }
        const params = new URLSearchParams({
          page: String(page),
          limit: String(VIDEOS_PER_PAGE),
          sort,
          order: "desc",
        });

        if (filterAccountId) {
          params.set("accountId", filterAccountId);
        }
        if (filterTag) {
          params.set("tag", filterTag);
        }

        const result = await apiClient.get<PaginatedData<DouyinVideoWithAccountDTO>>(`/videos?${params.toString()}`);
        if (!cancelled) {
          setVideos(result.items);
          setTotal(result.total);
          hasLoadedVideosRef.current = true;
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.message : getAccountsVideoFeedLoadErrorMessage());
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
  }, [status, page, filterAccountId, filterTag, sort, refreshKey]);

  function handleAddSuccess() {
    setPage(1);
    setRefreshKey((current) => current + 1);
  }

  function handleAccountChange(accountId: string | undefined) {
    setFilterAccountId(accountId);
    setPage(1);
  }

  function handleTagChange(tag: string | undefined) {
    setFilterTag(tag);
    setPage(1);
  }

  function handleSortChange(nextSort: "publishedAt" | "likeCount") {
    setSort(nextSort);
    setPage(1);
  }

  if (status === "loading") {
    return null;
  }

  return (
    <DashboardPageShell
      eyebrow={ACCOUNTS_EYEBROW}
      title={title}
      description={description}
      maxWidth="wide"
      actions={
        isEmployee ? (
          <Button onClick={() => setDrawerOpen(true)} size="sm" className="h-8 rounded-md px-3 text-sm shadow-sm">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {ACCOUNTS_ADD_ACTION_LABEL}
          </Button>
        ) : null
      }
    >
      <div className="animate-in-up-d1">
        <SurfaceSection
          eyebrow="Source Dossiers"
          title={getAccountsLibrarySectionTitle(userRole)}
          description={getAccountsLibrarySectionDescription(userRole)}
          actions={
            <MetaPillList
              items={[
                { label: getAccountsCountLabel(accounts.length), tone: "primary" },
                { label: getAccountsSyncHint() },
              ]}
            />
          }
          bodyClassName="space-y-5"
        >
          {accountsLoading ? (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-72 animate-pulse rounded-3xl border border-border/60 bg-card" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <AccountEmptyState onAdd={isEmployee ? () => setDrawerOpen(true) : undefined} />
          ) : (
            <AccountCardGrid
              accounts={accounts}
              onCardClick={(account) => router.push(`/accounts/${account.id}`)}
            />
          )}
        </SurfaceSection>
      </div>

      {accounts.length > 0 ? (
        <div className="animate-in-up-d2">
          <SurfaceSection
            eyebrow="Content Samples"
            title={ACCOUNTS_VIDEO_SECTION_TITLE}
            description={ACCOUNTS_VIDEO_SECTION_DESCRIPTION}
            bodyClassName="space-y-5"
            actions={
              <MetaPillList
                items={[
                  { label: getAccountsVideoCountLabel(total), tone: "primary" },
                  { label: getAccountsFilterSummary(filterAccountId, filterTag, sort, accounts) },
                ]}
              />
            }
          >
            <VideoFilterBar
              accounts={accounts}
              availableTags={availableTags}
              accountId={filterAccountId}
              tag={filterTag}
              sort={sort}
              onAccountChange={handleAccountChange}
              onTagChange={handleTagChange}
              onSortChange={handleSortChange}
            />

            <VideoGrid videos={videos} loading={videosLoading} onVideoClick={setSelectedVideo} />
            <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
          </SurfaceSection>
        </div>
      ) : null}

      <VideoDetailDialog
        video={selectedVideo}
        open={selectedVideo !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedVideo(null);
          }
        }}
      />

      <AccountAddDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onSuccess={handleAddSuccess} />
    </DashboardPageShell>
  );
}

