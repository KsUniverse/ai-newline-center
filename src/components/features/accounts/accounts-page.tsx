"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

import type { PaginatedData } from "@/types/api";
import type { DouyinAccountDTO, DouyinVideoWithAccountDTO } from "@/types/douyin-account";
import { ApiError, apiClient } from "@/lib/api-client";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { Button } from "@/components/ui/button";

import { AccountAddDrawer } from "./account-add-drawer";
import { AccountEmptyState } from "./account-empty-state";
import { AccountRow } from "./account-row";
import { VideoDetailDialog } from "./video-detail-dialog";
import { VideoFilterBar } from "./video-filter-bar";
import { VideoGrid } from "./video-grid";

const VIDEOS_PER_PAGE = 20;

function getPageMeta(role: string): { title: string; description: string } {
  switch (role) {
    case "BRANCH_MANAGER":
      return { title: "本公司账号", description: "查看本公司所有员工的抖音账号和视频" };
    case "SUPER_ADMIN":
      return { title: "所有账号", description: "查看全平台所有抖音账号和视频" };
    default:
      return { title: "我的账号", description: "管理你的抖音账号，浏览所有视频" };
  }
}

export function AccountsPageView() {
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

  const userRole = session?.user?.role ?? "EMPLOYEE";
  const isEmployee = userRole === "EMPLOYEE";
  const { title, description } = getPageMeta(userRole);
  const totalPages = Math.max(1, Math.ceil(total / VIDEOS_PER_PAGE));

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    videos.forEach((video) => video.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [videos]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;

    async function loadAccounts() {
      try {
        setAccountsLoading(true);
        const result = await apiClient.get<PaginatedData<DouyinAccountDTO>>("/douyin-accounts?page=1&limit=100");
        if (!cancelled) {
          setAccounts(result.items);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.message : "加载账号数据失败");
        }
      } finally {
        if (!cancelled) {
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
      try {
        setVideosLoading(true);
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
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.message : "加载视频数据失败");
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
  }, [status, page, filterAccountId, filterTag, sort, refreshKey]);

  function handleAddSuccess() {
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
      title={title}
      description={description}
      actions={
        isEmployee ? (
          <Button onClick={() => setDrawerOpen(true)} size="sm" className="h-8 rounded-md text-sm px-3 shadow-sm">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            添加账号
          </Button>
        ) : undefined
      }
    >
      <div className="animate-in-up-d1">
        {accountsLoading ? (
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-16 min-w-[200px] shrink-0 animate-pulse rounded-lg border border-border/60 bg-card"
              />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <AccountEmptyState onAdd={isEmployee ? () => setDrawerOpen(true) : undefined} />
        ) : (
          <AccountRow
            accounts={accounts}
            showAddButton={isEmployee}
            onAddClick={() => setDrawerOpen(true)}
          />
        )}
      </div>

      {accounts.length > 0 ? (
        <>
          <div className="animate-in-up-d2">
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
          </div>

          <div className="animate-in-up-d3">
            <VideoGrid videos={videos} loading={videosLoading} onVideoClick={setSelectedVideo} />
          </div>

          {!videosLoading && total > VIDEOS_PER_PAGE ? (
            <div className="flex items-center justify-center gap-4 pb-4">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                上一页
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                下一页
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </>
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
