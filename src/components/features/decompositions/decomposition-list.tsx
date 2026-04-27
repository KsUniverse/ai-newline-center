"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers, PenLine } from "lucide-react";

import type { DecompositionListItemDTO } from "@/types/ai-workspace";
import { proxyImageUrl } from "@/lib/utils";
import { BRAND_TABLE_WRAPPER_CLASS_NAME } from "@/components/shared/common/brand";
import { TaskEmptyState } from "@/components/shared/common/task-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DecompositionListProps {
  items: DecompositionListItemDTO[];
  isLoading: boolean;
  hasMore: boolean;
  hasFilters: boolean;
  isInitialized: boolean;
  onLoadMore: () => void;
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-border/40">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-4 px-4 py-3"
        >
          <div className="aspect-[9/16] w-10 shrink-0 rounded-md bg-muted/60" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-muted/60" />
            <div className="h-3 w-1/2 rounded bg-muted/40" />
          </div>
          <div className="h-5 w-28 shrink-0 rounded bg-muted/50" />
          <div className="h-5 w-10 shrink-0 rounded bg-muted/50" />
          <div className="h-5 w-14 shrink-0 rounded bg-muted/50" />
          <div className="h-4 w-16 shrink-0 rounded bg-muted/40" />
          <div className="h-7 w-20 shrink-0 rounded bg-muted/40" />
        </div>
      ))}
    </div>
  );
}

export function DecompositionList({
  items,
  isLoading,
  hasMore,
  hasFilters,
  isInitialized,
  onLoadMore,
}: DecompositionListProps) {
  const router = useRouter();

  // Show skeleton during initial/filter load (empty list + loading)
  if (isLoading && items.length === 0) {
    return (
      <div className={BRAND_TABLE_WRAPPER_CLASS_NAME}>
        <TableSkeleton />
      </div>
    );
  }

  // Empty state
  if (isInitialized && items.length === 0) {
    if (hasFilters) {
      return (
        <TaskEmptyState
          icon={Layers}
          title="没有符合条件的拆解记录"
          description="尝试修改筛选条件"
          tone="muted"
        />
      );
    }
    return (
      <TaskEmptyState
        icon={Layers}
        title="你还没有使用过 AI 工作台"
        description="前往对标账号视频列表开启拆解"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/benchmarks">前往对标账号</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className={BRAND_TABLE_WRAPPER_CLASS_NAME}>
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-border/40 px-4 py-2.5">
          <div className="w-10 shrink-0" />
          <p className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
            视频标题
          </p>
          <p className="w-36 shrink-0 text-xs font-medium text-muted-foreground">
            对标账号
          </p>
          <p className="w-10 shrink-0 text-xs font-medium text-muted-foreground">
            批注
          </p>
          <p className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
            状态
          </p>
          <p className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
            更新时间
          </p>
          <p className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
            操作
          </p>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/40">
          {items.map((item) => (
            <div
              key={item.workspaceId}
              className="flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/30"
              onClick={() => router.push(`/benchmarks/${item.accountId}?videoId=${item.videoId}`)}
            >
              {/* Cover */}
              <div className="aspect-[9/16] w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                {item.videoCoverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proxyImageUrl(item.videoCoverUrl)}
                    alt={item.videoTitle}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>

              {/* Title */}
              <p className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug text-foreground/90">
                {item.videoTitle}
              </p>

              {/* Account */}
              <div className="flex w-36 shrink-0 items-center gap-2 overflow-hidden">
                {item.accountAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proxyImageUrl(item.accountAvatar)}
                    alt={item.accountNickname}
                    className="h-6 w-6 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-6 w-6 shrink-0 rounded-full bg-muted" />
                )}
                <span className="truncate text-sm text-muted-foreground">
                  {item.accountNickname}
                </span>
              </div>

              {/* Annotation count */}
              <div className="w-10 shrink-0">
                <Badge variant="secondary">{item.annotationCount}</Badge>
              </div>

              {/* Status badge */}
              <div className="w-16 shrink-0">
                {item.annotationCount > 0 ? (
                  <span className="inline-flex items-center rounded-md border border-green-600/20 bg-green-600/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:border-green-400/20 dark:bg-green-400/10 dark:text-green-400">
                    有批注
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md border border-border/45 bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    无批注
                  </span>
                )}
              </div>

              {/* Updated at */}
              <p className="w-20 shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(item.updatedAt)}
              </p>

              {/* Action — stop row click propagation */}
              <div
                className="w-20 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {item.annotationCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      router.push(
                        `/benchmarks/${item.accountId}?videoId=${item.videoId}&stage=rewrite`,
                      )
                    }
                  >
                    <PenLine className="mr-1 h-3 w-3" />
                    发起仿写
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-foreground" />
                加载中…
              </span>
            ) : (
              "加载更多"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
