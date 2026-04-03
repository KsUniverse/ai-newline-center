"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import type { DouyinAccountDTO, DouyinVideoWithAccountDTO } from "@/types/douyin-account";
import type { PaginatedData } from "@/types/api";
import { AccountRow } from "@/components/features/accounts/account-row";
import { AccountEmptyState } from "@/components/features/accounts/account-empty-state";
import { AccountAddDrawer } from "@/components/features/accounts/account-add-drawer";
import { VideoGrid } from "@/components/features/accounts/video-grid";
import { VideoFilterBar } from "@/components/features/accounts/video-filter-bar";
import { VideoDetailDialog } from "@/components/features/accounts/video-detail-dialog";
import { Button } from "@/components/ui/button";
import { apiClient, ApiError } from "@/lib/api-client";

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

export default function AccountsPage() {
  const { data: session, status } = useSession();

  // Data states
  const [accounts, setAccounts] = useState<DouyinAccountDTO[]>([]);
  const [videos, setVideos] = useState<DouyinVideoWithAccountDTO[]>([]);
  const [total, setTotal] = useState(0);

  // UI states
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<DouyinVideoWithAccountDTO | null>(null);

  // Filter states
  const [page, setPage] = useState(1);
  const [filterAccountId, setFilterAccountId] = useState<string | undefined>();
  const [filterTag, setFilterTag] = useState<string | undefined>();
  const [sort, setSort] = useState<"publishedAt" | "likeCount">("publishedAt");

  const userRole = session?.user?.role ?? "EMPLOYEE";
  const isEmployee = userRole === "EMPLOYEE";
  const { title, description } = getPageMeta(userRole);
  const totalPages = Math.max(1, Math.ceil(total / VIDEOS_PER_PAGE));

  // Collect unique tags from loaded videos
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    videos.forEach((v) => v.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [videos]);

  // Load accounts
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    async function loadAccounts() {
      try {
        setAccountsLoading(true);
        const result = await apiClient.get<PaginatedData<DouyinAccountDTO>>(
          "/douyin-accounts?page=1&limit=100",
        );
        if (!cancelled) setAccounts(result.items);
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof ApiError ? error.message : "加载账号数据失败";
          toast.error(message);
        }
      } finally {
        if (!cancelled) setAccountsLoading(false);
      }
    }

    void loadAccounts();
    return () => { cancelled = true; };
  }, [status, refreshKey]);

  // Load videos (reacts to filter/sort/page changes)
  useEffect(() => {
    if (status !== "authenticated") return;
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
        if (filterAccountId) params.set("accountId", filterAccountId);
        if (filterTag) params.set("tag", filterTag);

        const result = await apiClient.get<PaginatedData<DouyinVideoWithAccountDTO>>(
          `/videos?${params.toString()}`,
        );
        if (!cancelled) {
          setVideos(result.items);
          setTotal(result.total);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof ApiError ? error.message : "加载视频数据失败";
          toast.error(message);
        }
      } finally {
        if (!cancelled) setVideosLoading(false);
      }
    }

    void loadVideos();
    return () => { cancelled = true; };
  }, [status, page, filterAccountId, filterTag, sort, refreshKey]);

  // Filter change handlers — reset page to 1
  const handleAccountChange = useCallback((accountId: string | undefined) => {
    setFilterAccountId(accountId);
    setPage(1);
  }, []);

  const handleTagChange = useCallback((tag: string | undefined) => {
    setFilterTag(tag);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((newSort: "publishedAt" | "likeCount") => {
    setSort(newSort);
    setPage(1);
  }, []);

  function handleAddSuccess() {
    setRefreshKey((k) => k + 1);
  }

  if (status === "loading") {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-6 max-w-6xl mx-auto w-full">
      {/* Section 0: Header — title + add button */}
      <div className="animate-in-up flex items-center justify-between">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight leading-none text-foreground/90">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground/80">{description}</p>
        </div>
        {isEmployee && (
          <Button
            onClick={() => setDrawerOpen(true)}
            size="sm"
            className="h-8 rounded-md text-sm px-3 shadow-sm"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            添加账号
          </Button>
        )}
      </div>

      {/* Section 1: Account horizontal row */}
      <div className="animate-in-up-d1">
        {accountsLoading ? (
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 min-w-[200px] rounded-lg border border-border/60 bg-card animate-pulse shrink-0"
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

      {/* Only show filter bar + video grid when accounts exist */}
      {accounts.length > 0 && (
        <>
          {/* Section 2: Filter bar */}
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

          {/* Section 3: Video grid */}
          <div className="animate-in-up-d3">
            <VideoGrid
              videos={videos}
              loading={videosLoading}
              onVideoClick={setSelectedVideo}
            />
          </div>

          {/* Pagination */}
          {!videosLoading && total > VIDEOS_PER_PAGE && (
            <div className="flex items-center justify-center gap-4 pb-4">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
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
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Video detail dialog */}
      <VideoDetailDialog
        video={selectedVideo}
        open={selectedVideo !== null}
        onOpenChange={(open) => { if (!open) setSelectedVideo(null); }}
      />

      {/* Add account drawer */}
      <AccountAddDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSuccess={handleAddSuccess}
      />
    </div>
  );
}
