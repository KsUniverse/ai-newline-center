"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import type { PaginatedData } from "@/types/api";
import type { BenchmarkAccountDTO } from "@/types/douyin-account";
import { ApiError, apiClient } from "@/lib/api-client";
import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";

import { BenchmarkCardGrid } from "./benchmark-card-grid";
import { BenchmarkEmptyState } from "./benchmark-empty-state";
import { BenchmarkPagination } from "./benchmark-pagination";
import { BenchmarkSurfaceSection } from "./benchmark-surface-section";
import {
  BENCHMARK_BACK_TO_LIBRARY_LABEL,
  BENCHMARK_LIBRARY_ARCHIVED_DESCRIPTION,
  BENCHMARK_LIBRARY_ARCHIVED_LIST_DESCRIPTION,
  BENCHMARK_LIBRARY_ARCHIVED_LIST_TITLE,
  BENCHMARK_LIBRARY_ARCHIVED_TITLE,
  getBenchmarkArchivedListLoadErrorMessage,
  getBenchmarkLibraryCountLabel,
  getBenchmarkLibrarySyncHint,
} from "./benchmark-copy";

const LIMIT = 20;

export function BenchmarksArchivedPageView() {
  const { status } = useSession();
  const [accounts, setAccounts] = useState<BenchmarkAccountDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    async function loadAccounts() {
      try {
        setLoading(true);
        const result = await apiClient.get<PaginatedData<BenchmarkAccountDTO>>(
          `/benchmarks/archived?page=${page}&limit=${LIMIT}`,
        );
        if (!cancelled) {
          setAccounts(result.items);
          setTotal(result.total);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.message : getBenchmarkArchivedListLoadErrorMessage());
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
  }, [status, page]);

  if (status === "loading") return null;

  return (
    <DashboardPageShell
      eyebrow="Research Archive"
      title={BENCHMARK_LIBRARY_ARCHIVED_TITLE}
      description={BENCHMARK_LIBRARY_ARCHIVED_DESCRIPTION}
      backHref="/benchmarks"
      backLabel={BENCHMARK_BACK_TO_LIBRARY_LABEL}
      maxWidth="wide"
    >
      <div className="animate-in-up-d1">
        <BenchmarkSurfaceSection
          eyebrow="Archived Dossiers"
          title={BENCHMARK_LIBRARY_ARCHIVED_LIST_TITLE}
          description={BENCHMARK_LIBRARY_ARCHIVED_LIST_DESCRIPTION}
          actions={
            <MetaPillList
              items={[
                { label: getBenchmarkLibraryCountLabel(total, true), tone: "primary" },
                { label: getBenchmarkLibrarySyncHint(true) },
              ]}
            />
          }
          bodyClassName="space-y-5"
        >
          {loading ? (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-72 animate-pulse rounded-3xl border border-border/60 bg-card"
                />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <BenchmarkEmptyState archived />
          ) : (
            <>
              <BenchmarkCardGrid accounts={accounts} archived />
              <BenchmarkPagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </BenchmarkSurfaceSection>
      </div>
    </DashboardPageShell>
  );
}

