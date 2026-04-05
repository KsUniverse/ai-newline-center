"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Archive } from "lucide-react";

import type { BenchmarkAccountDTO } from "@/types/douyin-account";
import { proxyImageUrl, formatNumber, formatDateTime } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface BenchmarkCardProps {
  account: BenchmarkAccountDTO;
  archived?: boolean;
  currentUserId?: string;
  onArchive?: (id: string) => void;
}

export function BenchmarkCard({
  account,
  archived = false,
  currentUserId,
  onArchive,
}: BenchmarkCardProps) {
  const router = useRouter();
  const showMenu = !archived && !!currentUserId && account.userId === currentUserId;

  return (
    <div
      role="button"
      tabIndex={0}
      className="group relative flex items-start gap-4 border border-border/60 rounded-lg bg-card p-4 text-left transition-colors hover:bg-muted/30 cursor-pointer w-full"
      onClick={() => router.push(`/benchmarks/${account.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/benchmarks/${account.id}`);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxyImageUrl(account.avatar)}
        alt={account.nickname}
        className="h-12 w-12 shrink-0 rounded-full bg-muted object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground/90">{account.nickname}</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap tabular-nums tracking-tight">
            <span className="text-foreground/80 font-medium">
              {formatNumber(account.followersCount)}
            </span>{" "}
            粉丝
          </span>
          <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap tabular-nums tracking-tight">
            <span className="text-foreground/80 font-medium">
              {formatNumber(account.videosCount)}
            </span>{" "}
            作品
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">由 {account.creatorName} 添加</p>
        {archived && account.deletedAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            归档于 {formatDateTime(account.deletedAt)}
          </p>
        )}
      </div>

      {showMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">更多操作</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onArchive?.(account.id);
              }}
            >
              <Archive className="mr-2 h-4 w-4" />
              归档
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
