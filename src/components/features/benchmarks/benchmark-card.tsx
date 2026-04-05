"use client";

import { useRouter } from "next/navigation";
import { Archive, ArrowUpRight, MoreHorizontal } from "lucide-react";

import type { BenchmarkAccountDTO } from "@/types/douyin-account";
import { cn, formatDateTime, formatNumber, formatRelativeTime, proxyImageUrl } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

import {
  getBenchmarkArchiveActionLabel,
  getBenchmarkCreatedByLabel,
  getBenchmarkCardSummaryFallback,
  getBenchmarkSharedLabel,
} from "./benchmark-copy";

interface BenchmarkCardProps {
  account: BenchmarkAccountDTO;
  archived?: boolean;
  onArchive?: (account: BenchmarkAccountDTO) => void;
}

export function BenchmarkCard({
  account,
  archived = false,
  onArchive,
}: BenchmarkCardProps) {
  const router = useRouter();
  const showMenu = !archived && account.canArchive && Boolean(onArchive);
  const summary = account.signature ?? account.bio ?? getBenchmarkCardSummaryFallback();
  const metrics = [
    { label: "粉丝", value: formatNumber(account.followersCount) },
    { label: "关注", value: formatNumber(account.followingCount) },
    { label: "获赞", value: formatNumber(account.likesCount) },
  ];
  const showVerification = Boolean(account.verificationLabel);

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/90 p-5 text-left shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10",
      )}
      onClick={() => router.push(`/benchmarks/${account.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(`/benchmarks/${account.id}`);
        }
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_42%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.08),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.18]" />

      <div className="relative flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={proxyImageUrl(account.avatar)}
          alt={account.nickname}
          className="h-14 w-14 shrink-0 rounded-full border border-border/60 bg-muted object-cover"
        />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/75">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  组织共享
                </span>
                {archived && account.deletedAt ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                    归档于 {formatDateTime(account.deletedAt)}
                  </span>
                ) : null}
                {account.douyinNumber ? (
                  <span className="inline-flex items-center rounded-full border border-border/60 bg-background/80 px-2.5 py-1 font-mono normal-case tracking-normal text-muted-foreground">
                    {account.douyinNumber}
                  </span>
                ) : null}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-lg font-semibold tracking-tight text-foreground/95">
                    {account.nickname}
                  </p>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                {showVerification ? (
                  <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-2xs text-primary">
                    {account.verificationIconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={account.verificationIconUrl}
                        alt="认证"
                        className="h-3.5 w-3.5 shrink-0 object-contain"
                      />
                    ) : (
                      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                        V
                      </span>
                    )}
                    <span className="truncate">{account.verificationLabel}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {showMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                    <span className="sr-only">更多操作</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-36 border-border/60 bg-popover/95"
                  onClick={(event) => event.stopPropagation()}
                >
                  <DropdownMenuItem
                    className="cursor-pointer py-1.5 text-sm text-destructive focus:text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      onArchive?.(account);
                    }}
                  >
                    <Archive className="mr-2 h-3.5 w-3.5" />
                    {getBenchmarkArchiveActionLabel()}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground/85">{summary}</p>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-border/60 bg-background/70 p-3"
          >
            <p className="text-2xs uppercase tracking-[0.18em] text-muted-foreground/70">
              {metric.label}
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-foreground/95">
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      <div className="relative mt-5 space-y-3 border-t border-border/60 pt-4">
        <div className="flex flex-wrap items-center gap-2 text-2xs uppercase tracking-[0.18em] text-muted-foreground/75">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 normal-case tracking-normal text-muted-foreground">
            {getBenchmarkCreatedByLabel(account.creatorName)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 normal-case tracking-normal text-muted-foreground">
            首次录入 {formatRelativeTime(account.createdAt)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="min-w-0 truncate text-muted-foreground">{getBenchmarkSharedLabel(account.creatorName)}</p>
          <span className="shrink-0 text-2xs uppercase tracking-[0.18em] text-foreground/70">
            查看档案
          </span>
        </div>
      </div>
    </div>
  );
}
