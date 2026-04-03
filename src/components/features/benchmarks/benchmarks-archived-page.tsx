"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import type { PaginatedData } from "@/types/api";
import type { BenchmarkAccountDTO } from "@/types/douyin-account";
import { ApiError, apiClient } from "@/lib/api-client";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { Button } from "@/components/ui/button";

import { BenchmarkCardGrid } from "./benchmark-card-grid";
import { BenchmarkEmptyState } from "./benchmark-empty-state";

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
          toast.error(error instanceof ApiError ? error.message : "加载归档账号失败");
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
      title="已归档对标账号"
      backHref="/benchmarks"
      backLabel="返回对标账号"
    >
      <div className="animate-in-up-d1">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-lg border border-border/60 bg-card"
              />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <BenchmarkEmptyState archived />
        ) : (
          <BenchmarkCardGrid accounts={accounts} archived />
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
    </DashboardPageShell>
  );
}

