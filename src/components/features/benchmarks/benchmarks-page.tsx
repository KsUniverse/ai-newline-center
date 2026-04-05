"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Archive, Plus } from "lucide-react";
import { toast } from "sonner";

import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";

import type { PaginatedData } from "@/types/api";
import type { BenchmarkAccountDTO } from "@/types/douyin-account";
import { ApiError, apiClient } from "@/lib/api-client";
import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { Button } from "@/components/ui/button";

import { BenchmarkAddDrawer } from "./benchmark-add-drawer";
import { BenchmarkArchiveDialog } from "./benchmark-archive-dialog";
import { BenchmarkCardGrid } from "./benchmark-card-grid";
import { BenchmarkEmptyState } from "./benchmark-empty-state";
import { BenchmarkPagination } from "./benchmark-pagination";
import { BenchmarkSurfaceSection } from "./benchmark-surface-section";
import {
  BENCHMARK_ADD_ACTION_LABEL,
  BENCHMARK_ARCHIVE_LINK_LABEL,
  BENCHMARK_LIBRARY_DESCRIPTION,
  BENCHMARK_LIBRARY_EYEBROW,
  BENCHMARK_LIBRARY_LIST_DESCRIPTION,
  BENCHMARK_LIBRARY_LIST_TITLE,
  BENCHMARK_LIBRARY_TITLE,
  getBenchmarkArchiveErrorMessage,
  getBenchmarkArchiveSuccessMessage,
  getBenchmarkLibraryCountLabel,
  getBenchmarkLibrarySyncHint,
  getBenchmarkListLoadErrorMessage,
} from "./benchmark-copy";

const LIMIT = 20;

export function BenchmarksPageView() {
  const { status } = useSession();
  const [accounts, setAccounts] = useState<BenchmarkAccountDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const hasLoadedAccountsRef = useRef(false);
  useAutoRefresh(60_000, () => setRefreshKey((k) => k + 1));
  const [page, setPage] = useState(1);
  const [archiveTarget, setArchiveTarget] = useState<BenchmarkAccountDTO | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    async function loadAccounts() {
      const shouldShowLoading = !hasLoadedAccountsRef.current;
      try {
        if (shouldShowLoading) {
          setLoading(true);
        }
        const result = await apiClient.get<PaginatedData<BenchmarkAccountDTO>>(
          `/benchmarks?page=${page}&limit=${LIMIT}`,
        );
        if (!cancelled) {
          setAccounts(result.items);
          setTotal(result.total);
          hasLoadedAccountsRef.current = true;
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.message : getBenchmarkListLoadErrorMessage());
        }
      } finally {
        if (!cancelled && shouldShowLoading) {
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
    setPage(1);
    setRefreshKey((k) => k + 1);
  }

  function handleConfirmArchive() {
    if (!archiveTarget) return;
    const targetId = archiveTarget.id;
    setArchiveTarget(null);

    apiClient
      .del(`/benchmarks/${targetId}`)
      .then(() => {
        toast.success(getBenchmarkArchiveSuccessMessage());
        setRefreshKey((k) => k + 1);
      })
      .catch((error: unknown) => {
        toast.error(getBenchmarkArchiveErrorMessage(error));
      });
  }

  if (status === "loading") return null;

  return (
    <DashboardPageShell
      eyebrow={BENCHMARK_LIBRARY_EYEBROW}
      title={BENCHMARK_LIBRARY_TITLE}
      description={BENCHMARK_LIBRARY_DESCRIPTION}
      maxWidth="wide"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 rounded-md px-3 text-sm" asChild>
            <Link href="/benchmarks/archived">
              <Archive className="mr-1.5 h-3.5 w-3.5" />
              {BENCHMARK_ARCHIVE_LINK_LABEL}
            </Link>
          </Button>
          <Button
            onClick={() => setDrawerOpen(true)}
            size="sm"
            className="h-8 rounded-md px-3 text-sm shadow-sm"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {BENCHMARK_ADD_ACTION_LABEL}
          </Button>
        </div>
      }
    >
      <div className="animate-in-up-d1">
        <BenchmarkSurfaceSection
          eyebrow="Active Dossiers"
          title={BENCHMARK_LIBRARY_LIST_TITLE}
          description={BENCHMARK_LIBRARY_LIST_DESCRIPTION}
          actions={
            <MetaPillList
              items={[
                { label: getBenchmarkLibraryCountLabel(total), tone: "primary" },
                { label: getBenchmarkLibrarySyncHint() },
              ]}
            />
          }
          bodyClassName="space-y-5"
        >
          {loading ? (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-72 animate-pulse rounded-3xl border border-border/60 bg-card"
                />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <BenchmarkEmptyState onAdd={() => setDrawerOpen(true)} />
          ) : (
            <>
              <BenchmarkCardGrid
                accounts={accounts}
                onArchive={(account) => {
                  if (!account.canArchive) return;
                  setArchiveTarget(account);
                }}
              />
              <BenchmarkPagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </BenchmarkSurfaceSection>
      </div>

      <BenchmarkAddDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSuccess={handleAddSuccess}
      />

      <BenchmarkArchiveDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        onConfirm={handleConfirmArchive}
        nickname={archiveTarget?.nickname}
      />
    </DashboardPageShell>
  );
}

