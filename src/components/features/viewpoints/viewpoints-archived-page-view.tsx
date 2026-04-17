"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";

import type { CursorPaginatedData } from "@/types/api";
import type { FragmentDTO } from "@/types/fragment";
import { apiClient } from "@/lib/api-client";
import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { SurfaceSection } from "@/components/shared/common/surface-section";
import { TaskEmptyState } from "@/components/shared/common/task-empty-state";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { groupHistoricalViewpointsByDate } from "./viewpoints-grouping";

function formatAbsoluteTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ArchivedViewpointSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-44 animate-pulse rounded-3xl border border-border/60 bg-card/82 shadow-sm"
        />
      ))}
    </div>
  );
}

export function ViewpointsArchivedPageView() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FragmentDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setInitialLoaded(false);

    const params = new URLSearchParams({
      limit: "40",
      scope: "history",
    });
    if (query) {
      params.set("q", query);
    }

    void apiClient
      .get<CursorPaginatedData<FragmentDTO>>(`/viewpoints?${params.toString()}`)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setItems(result.items);
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        toast.error(error instanceof Error ? error.message : "历史观点加载失败");
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setLoading(false);
        setInitialLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  const groups = useMemo(() => groupHistoricalViewpointsByDate(items), [items]);

  function handleQueryChange(value: string) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setQuery(value);
    }, 300);
  }

  async function handleLoadMore() {
    if (!nextCursor) {
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "40",
        scope: "history",
        cursor: nextCursor,
      });
      if (query) {
        params.set("q", query);
      }

      const result = await apiClient.get<CursorPaginatedData<FragmentDTO>>(
        `/viewpoints?${params.toString()}`,
      );

      setItems((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载更多历史观点失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardPageShell
      eyebrow="Viewpoint Archive"
      title="历史归档"
      description="按日期回看组织内过往观点记录。"
      backHref="/viewpoints"
      backLabel="返回今日观点"
      maxWidth="wide"
    >
      <MetaPillList
        items={[
          { label: `历史 ${items.length} 条`, tone: "primary" },
          { label: "按日期归档展示" },
        ]}
      />

      <SurfaceSection
        eyebrow="Archived Signals"
        title="历史观点时间线"
        description="检索过往观点沉淀，按日期查看同一天内的观点簇。"
        bodyClassName="space-y-6"
      >
        <Input
          type="search"
          placeholder="搜索历史观点..."
          onChange={(event) => handleQueryChange(event.target.value)}
          className="max-w-sm rounded-2xl border-border/60 bg-background/80"
        />

        {!initialLoaded ? (
          <ArchivedViewpointSkeleton />
        ) : groups.length === 0 ? (
          <TaskEmptyState
            icon={History}
            eyebrow="Archive Memory"
            title="历史归档暂时为空"
            description={query ? "没有匹配的历史观点" : "当前还没有历史观点可供回看。"}
            tone="muted"
          />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.key} className="space-y-3">
                <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">
                  {group.label}
                </p>
                <div className="space-y-3">
                  {group.items.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-border/60 bg-background/80 px-4 py-4 shadow-sm"
                    >
                      <p className="text-sm leading-7 text-foreground/90">{item.content}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground/70">
                        <span>{item.createdByUser.name}</span>
                        <span>·</span>
                        <span>{formatAbsoluteTime(item.createdAt)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}

            {hasMore ? (
              <Button type="button" variant="outline" onClick={handleLoadMore} disabled={loading}>
                {loading ? "加载中..." : "加载更多历史观点"}
              </Button>
            ) : null}
          </div>
        )}
      </SurfaceSection>
    </DashboardPageShell>
  );
}
