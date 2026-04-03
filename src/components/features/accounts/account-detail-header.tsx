"use client";

import { proxyImageUrl, formatNumber } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { AccountSyncSection } from "./account-sync-section";
import type { DouyinAccountDetailDTO } from "@/types/douyin-account";

interface AccountDetailHeaderProps {
  account: DouyinAccountDetailDTO;
  onSyncSuccess: (newLastSyncedAt: string) => void;
}

export function AccountDetailHeader({ account, onSyncSuccess }: AccountDetailHeaderProps) {
  const location = [account.province, account.city].filter(Boolean).join(" · ");
  const showVerification = Boolean(account.verificationLabel);

  return (
    <div className="flex items-start gap-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxyImageUrl(account.avatar)}
        alt={account.nickname}
        className="h-20 w-20 shrink-0 rounded-full bg-muted object-cover"
      />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground/90">
              {account.nickname}
            </h2>
            {showVerification && (
              <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#2b2210] px-2 py-0.5 text-xs text-[#f5d37a]">
                {account.verificationIconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={account.verificationIconUrl}
                    alt="认证"
                    className="h-3.5 w-3.5 shrink-0 object-contain"
                  />
                ) : (
                  <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#f5d37a] text-[9px] font-bold text-[#1e1e24]">
                    V
                  </span>
                )}
                <span className="truncate">{account.verificationLabel}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="tabular-nums tracking-tight">
              关注{" "}
              <span className="text-foreground/80 font-medium">
                {formatNumber(account.followingCount)}
              </span>
            </span>
            <Separator orientation="vertical" className="h-3" />
            <span className="tabular-nums tracking-tight">
              粉丝{" "}
              <span className="text-foreground/80 font-medium">
                {formatNumber(account.followersCount)}
              </span>
            </span>
            <Separator orientation="vertical" className="h-3" />
            <span className="tabular-nums tracking-tight">
              获赞{" "}
              <span className="text-foreground/80 font-medium">
                {formatNumber(account.likesCount)}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground/85">
            {account.douyinNumber && (
              <span className="rounded-md bg-muted/60 px-2 py-1">
                抖音号：{account.douyinNumber}
              </span>
            )}
            {account.ipLocation && (
              <span className="rounded-md bg-muted/60 px-2 py-1">
                {account.ipLocation}
              </span>
            )}
            {account.age !== null && (
              <span className="rounded-md bg-muted/60 px-2 py-1">
                {account.age} 岁
              </span>
            )}
            {location && (
              <span className="rounded-md bg-muted/60 px-2 py-1">
                {location}
              </span>
            )}
          </div>
          {account.signature && (
            <p className="text-sm leading-6 text-foreground/85">
              {account.signature}
            </p>
          )}
          {!account.signature && account.bio && (
            <p className="text-sm leading-6 text-foreground/85">
              {account.bio}
            </p>
          )}
        </div>
        <AccountSyncSection
          accountId={account.id}
          lastSyncedAt={account.lastSyncedAt}
          onSyncSuccess={onSyncSuccess}
        />
      </div>
    </div>
  );
}
