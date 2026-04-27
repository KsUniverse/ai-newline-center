"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { toast } from "sonner";

import type { CursorPaginatedData } from "@/types/api";
import type { DecompositionListItemDTO } from "@/types/ai-workspace";
import { apiClient } from "@/lib/api-client";
import { proxyImageUrl } from "@/lib/utils";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { DecompositionList } from "./decomposition-list";

type FilterAccount = {
  id: string;
  nickname: string;
  avatar: string;
};

export function DecompositionsPage() {
  const [filterAccountIds, setFilterAccountIds] = useState<string[]>([]);
  const [hasAnnotations, setHasAnnotations] = useState<boolean | undefined>(
    undefined,
  );
  const [allItems, setAllItems] = useState<DecompositionListItemDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [filterAccountOptions, setFilterAccountOptions] = useState<
    FilterAccount[]
  >([]);

  const loadVersionRef = useRef(0);
  const isFirstFilterRender = useRef(true);

  const hasActiveFilters =
    filterAccountIds.length > 0 || hasAnnotations !== undefined;

  // Initial parallel load: list + filter accounts
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      apiClient.get<CursorPaginatedData<DecompositionListItemDTO>>(
        "/decompositions?limit=20",
      ),
      apiClient.get<FilterAccount[]>("/decompositions/filter-accounts"),
    ])
      .then(([listResult, accountsResult]) => {
        if (cancelled) return;
        setAllItems(listResult.items);
        setNextCursor(listResult.nextCursor);
        setHasMore(listResult.hasMore);
        setFilterAccountOptions(accountsResult);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(
          error instanceof Error ? error.message : "加载拆解列表失败",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          setIsInitialized(true);
          isFirstFilterRender.current = false;
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Reload list when filters change (skip initial render)
  useEffect(() => {
    if (isFirstFilterRender.current) return;

    const version = ++loadVersionRef.current;
    setAllItems([]);
    setNextCursor(null);
    setHasMore(false);
    setIsLoading(true);

    const params = new URLSearchParams({ limit: "20" });
    if (hasAnnotations !== undefined) {
      params.set("hasAnnotations", String(hasAnnotations));
    }
    filterAccountIds.forEach((id) => params.append("benchmarkAccountIds", id));

    apiClient
      .get<CursorPaginatedData<DecompositionListItemDTO>>(
        `/decompositions?${params.toString()}`,
      )
      .then((result) => {
        if (version !== loadVersionRef.current) return;
        setAllItems(result.items);
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
      })
      .catch((error: unknown) => {
        if (version !== loadVersionRef.current) return;
        toast.error(
          error instanceof Error ? error.message : "加载拆解列表失败",
        );
      })
      .finally(() => {
        if (version === loadVersionRef.current) setIsLoading(false);
      });
  }, [filterAccountIds, hasAnnotations]);

  function handleLoadMore() {
    if (!hasMore || isLoading || !nextCursor) return;

    const version = ++loadVersionRef.current;
    setIsLoading(true);

    const params = new URLSearchParams({ limit: "20", cursor: nextCursor });
    if (hasAnnotations !== undefined) {
      params.set("hasAnnotations", String(hasAnnotations));
    }
    filterAccountIds.forEach((id) => params.append("benchmarkAccountIds", id));

    apiClient
      .get<CursorPaginatedData<DecompositionListItemDTO>>(
        `/decompositions?${params.toString()}`,
      )
      .then((result) => {
        if (version !== loadVersionRef.current) return;
        setAllItems((prev) => [...prev, ...result.items]);
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
      })
      .catch((error: unknown) => {
        if (version !== loadVersionRef.current) return;
        toast.error(error instanceof Error ? error.message : "加载更多失败");
      })
      .finally(() => {
        if (version === loadVersionRef.current) setIsLoading(false);
      });
  }

  function toggleAccountFilter(id: string) {
    setFilterAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleClearFilters() {
    setFilterAccountIds([]);
    setHasAnnotations(undefined);
  }

  const statusOptions = [
    { label: "全部", value: undefined },
    { label: "有批注", value: true as boolean | undefined },
    { label: "无批注", value: false as boolean | undefined },
  ] as const;

  return (
    <DashboardPageShell
      eyebrow="AI 拆解"
      title="拆解列表"
      description="你的全部 AI 工作台拆解记录"
    >
      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 对标账号多选下拉 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={
                filterAccountIds.length > 0 ? "border-primary/50" : ""
              }
            >
              {filterAccountIds.length > 0
                ? `已选 ${filterAccountIds.length} 个账号`
                : "所有账号"}
              <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {filterAccountOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                暂无可筛选账号
              </p>
            ) : (
              filterAccountOptions.map((account) => (
                <DropdownMenuCheckboxItem
                  key={account.id}
                  checked={filterAccountIds.includes(account.id)}
                  onCheckedChange={() => toggleAccountFilter(account.id)}
                >                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proxyImageUrl(account.avatar)}
                    alt={account.nickname}
                    className="mr-2 h-5 w-5 rounded-full object-cover"
                  />
                  {account.nickname}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 拆解状态单选 */}
        <div className="flex items-center gap-1">
          {statusOptions.map(({ label, value }) => (
            <Button
              key={label}
              variant={hasAnnotations === value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setHasAnnotations(value as boolean | undefined)}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* 清除筛选 */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            清除筛选
          </Button>
        )}

        {/* 排序指示 */}
        <span className="ml-auto text-xs text-muted-foreground/60">最近更新排序</span>
      </div>

      {/* 拆解列表 */}
      <DecompositionList
        items={allItems}
        isLoading={isLoading}
        isInitialized={isInitialized}
        hasMore={hasMore}
        hasFilters={hasActiveFilters}
        onLoadMore={handleLoadMore}
      />
    </DashboardPageShell>
  );
}
