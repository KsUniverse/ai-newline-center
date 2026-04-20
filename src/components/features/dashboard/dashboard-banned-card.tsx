"use client";

import { ShieldAlert, UserX } from "lucide-react";

import { cn, proxyImageUrl } from "@/lib/utils";
import { formatBannedAt, type BannedAccountItem } from "@/types/benchmark-video";

interface DashboardBannedCardProps {
  account: BannedAccountItem;
}

export function DashboardBannedCard({
  account,
}: DashboardBannedCardProps) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/55 bg-card/90 p-5 transition-all",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card",
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_42%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.08),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.18]" />

      <div className="relative flex items-start gap-4">
        {account.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxyImageUrl(account.avatar)}
            alt={account.nickname}
            className="h-14 w-14 shrink-0 rounded-full border border-border/45 bg-muted object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border/45 bg-muted">
            <UserX className="h-6 w-6 text-muted-foreground/60" />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/75">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-destructive">
              <ShieldAlert className="h-3.5 w-3.5" />
              封禁中
            </span>
            <span className="inline-flex items-center rounded-md border border-border/45 bg-background/80 px-2.5 py-1 font-mono normal-case tracking-normal text-muted-foreground">
              {account.douyinNumber ?? "未填写抖音号"}
            </span>
          </div>

          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-tight text-foreground/95">
              {account.nickname}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground/85">
              封禁时间 {formatBannedAt(account.bannedAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative mt-5 rounded-lg border border-border/55 bg-background/70 p-3">
        <p className="text-sm text-muted-foreground">
          该状态由账号资料定时同步自动识别，仪表盘仅展示命中过封禁条件的账号。
        </p>
      </div>
    </article>
  );
}
