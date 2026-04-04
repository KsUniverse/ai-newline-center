"use client";

import { useRouter } from "next/navigation";

import type { DouyinAccountDTO } from "@/types/douyin-account";
import { proxyImageUrl, formatNumber } from "@/lib/utils";

import { AccountLoginStatusBadge } from "./account-login-status-badge";

interface AccountRowCardProps {
  account: DouyinAccountDTO;
}

export function AccountRowCard({ account }: AccountRowCardProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(`/accounts/${account.id}`)}
      className="flex min-w-50 shrink-0 cursor-pointer items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxyImageUrl(account.avatar)}
        alt={account.nickname}
        className="h-9 w-9 shrink-0 rounded-full bg-muted object-cover"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground/90">
          {account.nickname}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-sm text-muted-foreground tabular-nums tracking-tight">
            {formatNumber(account.followersCount)} 粉丝
          </p>
          <AccountLoginStatusBadge status={account.loginStatus} />
        </div>
      </div>
    </button>
  );
}
