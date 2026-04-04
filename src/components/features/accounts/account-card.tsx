"use client";

import type { DouyinAccountDTO } from "@/types/douyin-account";
import { proxyImageUrl, formatNumber } from "@/lib/utils";

import { AccountLoginStatusBadge } from "./account-login-status-badge";

interface AccountCardProps {
  account: DouyinAccountDTO;
  onClick: () => void;
}

export function AccountCard({ account, onClick }: AccountCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-4 border border-border/60 rounded-lg bg-card p-4 text-left transition-colors hover:bg-muted/30 cursor-pointer w-full"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxyImageUrl(account.avatar)}
        alt={account.nickname}
        className="h-12 w-12 shrink-0 rounded-full bg-muted object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground/90">
            {account.nickname}
          </p>
          <AccountLoginStatusBadge status={account.loginStatus} />
        </div>
        {account.bio && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground/70">
            {account.bio}
          </p>
        )}
        <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="tabular-nums tracking-tight">
            <span className="text-foreground/80 font-medium">{formatNumber(account.followersCount)}</span>{" "}
            粉丝
          </span>
          <span className="tabular-nums tracking-tight">
            <span className="text-foreground/80 font-medium">{formatNumber(account.videosCount)}</span>{" "}
            作品
          </span>
        </div>
      </div>
    </button>
  );
}
