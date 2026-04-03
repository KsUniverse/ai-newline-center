"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import type { PaginatedData } from "@/types/api";
import type { BenchmarkAccountDTO } from "@/types/douyin-account";
import { ApiError, apiClient } from "@/lib/api-client";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
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

import { BenchmarkAddDrawer } from "./benchmark-add-drawer";
import { BenchmarkCardGrid } from "./benchmark-card-grid";
import { BenchmarkEmptyState } from "./benchmark-empty-state";

const LIMIT = 20;

export function BenchmarksPageView() {
  const { data: session, status } = useSession();
  const [accounts, setAccounts] = useState<BenchmarkAccountDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const currentUserId = session?.user?.id;

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    async function loadAccounts() {
      try {
        setLoading(true);
        const result = await apiClient.get<PaginatedData<BenchmarkAccountDTO>>(
          `/benchmarks?page=${page}&limit=${LIMIT}`,
        );
        if (!cancelled) {
          setAccounts(result.items);
          setTotal(result.total);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.message : "加载对标账号失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [status, page, refreshKey]);

  function handleAddSuccess() {
    setRefreshKey((k) => k + 1);
  }

  function handleConfirmArchive() {
    if (!archiveTargetId) return;
    const targetId = archiveTargetId;
    setArchiveTargetId(null);

    apiClient
      .del(`/benchmarks/${targetId}`)
      .then(() => {
        toast.success("已归档");
        setRefreshKey((k) => k + 1);
      })
      .catch((error: unknown) => {
        toast.error(error instanceof ApiError ? error.message : "归档失败，请稍后重试");
      });
  }

  if (status === "loading") return null;

  return (
    <DashboardPageShell
      title="对标账号"
      description="管理你的对标博主，通过收藏自动同步或手动添加"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="link" size="sm" className="text-sm text-muted-foreground" asChild>
            <Link href="/benchmarks/archived">查看已归档 →</Link>
          </Button>
          <Button
            onClick={() => setDrawerOpen(true)}
            size="sm"
            className="h-8 rounded-md text-sm px-3 shadow-sm"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            添加对标账号
          </Button>
        </div>
      }
    >
      <div className="animate-in-up-d1">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-lg border border-border/60 bg-card"
              />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <BenchmarkEmptyState onAdd={() => setDrawerOpen(true)} />
        ) : (
          <BenchmarkCardGrid
            accounts={accounts}
            currentUserId={currentUserId}
            onArchive={(id) => setArchiveTargetId(id)}
          />
        )}
      </div>

      {!loading && total > LIMIT && (
        <div className="flex items-center justify-center gap-4 pb-4 animate-in-up-d2">
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

      <BenchmarkAddDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSuccess={handleAddSuccess}
      />

      <AlertDialog
        open={archiveTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTargetId(null);
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
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmArchive}
            >
              确认归档
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardPageShell>
  );
}
