"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lightbulb, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { CursorPaginatedData } from "@/types/api";
import type { FragmentDTO } from "@/types/fragment";
import { apiClient } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/shared/common/confirm-dialog";
import { TaskEmptyState } from "@/components/shared/common/task-empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ViewpointsListProps {
  currentUserId: string;
  currentUserRole: string;
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function ViewpointSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-border/60 bg-card/82 p-4 shadow-sm"
        >
          <div className="mb-3 h-4 w-3/4 rounded-full bg-muted/60" />
          <div className="mb-2 h-4 w-full rounded-full bg-muted/60" />
          <div className="h-4 w-1/2 rounded-full bg-muted/60" />
          <div className="mt-3 h-3 w-32 rounded-full bg-muted/40" />
        </div>
      ))}
    </div>
  );
}

export function ViewpointsList({
  currentUserId,
  currentUserRole,
}: ViewpointsListProps) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FragmentDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadVersionRef = useRef(0);

  const canManageAny =
    currentUserRole === "BRANCH_MANAGER" || currentUserRole === "SUPER_ADMIN";

  const loadPage = useCallback(
    async (cursor: string | null, reset: boolean) => {
      const version = ++loadVersionRef.current;
      setLoading(true);

      try {
        const params = new URLSearchParams({ limit: "20" });
        if (query) params.set("q", query);
        if (cursor) params.set("cursor", cursor);

        const result = await apiClient.get<CursorPaginatedData<FragmentDTO>>(
          `/viewpoints?${params.toString()}`,
        );

        // Discard stale responses if a newer load was triggered
        if (version !== loadVersionRef.current) return;

        if (reset) {
          setItems(result.items);
        } else {
          setItems((prev) => [...prev, ...result.items]);
        }
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
      } catch (error) {
        if (version !== loadVersionRef.current) return;
        toast.error(error instanceof Error ? error.message : "加载观点列表失败");
      } finally {
        if (version === loadVersionRef.current) {
          setLoading(false);
          setInitialLoaded(true);
        }
      }
    },
    [query],
  );

  // Initial load and reload on query change
  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    setHasMore(false);
    setInitialLoaded(false);
    void loadPage(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Infinite scroll observer
  useEffect(() => {
    observerRef.current?.disconnect();

    if (!sentinelRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMore && !loading) {
          void loadPage(nextCursor, false);
        }
      },
      { threshold: 0.1 },
    );

    observerRef.current.observe(sentinelRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, loading, loadPage, nextCursor]);

  function handleQueryChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(value);
    }, 300);
  }

  async function handleDelete() {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await apiClient.del(`/viewpoints/${deleteTargetId}`);
      setItems((prev) => prev.filter((item) => item.id !== deleteTargetId));
      toast.success("观点已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败，请稍后重试");
    } finally {
      setDeleting(false);
      setDeleteTargetId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Input
        type="search"
        placeholder="搜索观点内容..."
        onChange={(e) => handleQueryChange(e.target.value)}
        className="max-w-sm rounded-2xl border-border/60 bg-background/80"
      />

      {!initialLoaded ? (
        <ViewpointSkeleton />
      ) : items.length === 0 ? (
        <TaskEmptyState
          icon={Lightbulb}
          eyebrow="Viewpoints"
          title="暂无观点"
          description={
            query ? `没有找到包含「${query}」的观点` : "还没有观点，点击「添加观点」开始录入"
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const canDelete = canManageAny || item.createdByUserId === currentUserId;
            return (
              <div
                key={item.id}
                className="group relative rounded-2xl border border-border/60 bg-card/82 px-4 py-4 shadow-sm transition-colors hover:border-border/80"
              >
                <p className="line-clamp-3 text-sm leading-7 text-foreground/90">{item.content}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                    <span>{item.createdByUser.name}</span>
                    <span>·</span>
                    <span>{formatRelativeTime(item.createdAt)}</span>
                  </div>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="h-7 w-7 shrink-0 rounded-xl p-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteTargetId(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          <div ref={sentinelRef} className="h-4" />

          {loading && (
            <div className="py-4 text-center text-xs text-muted-foreground/60">加载中...</div>
          )}

          {!hasMore && items.length > 0 && (
            <div className="py-2 text-center text-xs text-muted-foreground/40">已加载全部</div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
        title="删除观点"
        description="确认删除这条观点？此操作不可恢复。"
        confirmLabel="删除"
        onConfirm={handleDelete}
        destructive
        loading={deleting}
      />
    </div>
  );
}
