"use client";

import type { DouyinAccountDTO } from "@/types/douyin-account";
import { formatNumber, proxyImageUrl } from "@/lib/utils";

import { AccountLoginStatusBadge } from "./account-login-status-badge";
import { getAccountSourceLabel, getAccountSummaryFallback } from "./accounts-copy";

interface AccountCardProps {
  account: DouyinAccountDTO;
  onClick: () => void;
}

export function AccountCard({ account, onClick }: AccountCardProps) {
  const summary = account.signature ?? account.bio ?? getAccountSummaryFallback();

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/90 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_40%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.08),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.16]" />

      <div className="relative flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={proxyImageUrl(account.avatar)}
          alt={account.nickname}
          className="h-14 w-14 shrink-0 rounded-full border border-border/60 bg-muted object-cover"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/75">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              内容源账号
            </span>
            {account.douyinNumber ? (
              <span className="inline-flex items-center rounded-full border border-border/60 bg-background/80 px-2.5 py-1 font-mono normal-case tracking-normal text-muted-foreground">
                @{account.douyinNumber}
              </span>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-lg font-semibold tracking-tight text-foreground/95">
                {account.nickname}
              </p>
              <AccountLoginStatusBadge status={account.loginStatus} />
            </div>
            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground/80">{summary}</p>
          </div>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/60 bg-background/80 p-3 shadow-sm">
          <p className="text-2xs uppercase tracking-[0.18em] text-muted-foreground/70">粉丝</p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-foreground/95">
            {formatNumber(account.followersCount)}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/80 p-3 shadow-sm">
          <p className="text-2xs uppercase tracking-[0.18em] text-muted-foreground/70">作品</p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-foreground/95">
            {formatNumber(account.videosCount)}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/80 p-3 shadow-sm">
          <p className="text-2xs uppercase tracking-[0.18em] text-muted-foreground/70">获赞</p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-foreground/95">
            {formatNumber(account.likesCount)}
          </p>
        </div>
      </div>

      <div className="relative mt-5 border-t border-border/60 pt-4">
        <p className="truncate text-sm text-muted-foreground/80">{getAccountSourceLabel(account.nickname)}</p>
      </div>
    </button>
  );
}
