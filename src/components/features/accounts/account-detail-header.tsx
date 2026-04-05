"use client";

import { MapPin, MonitorPlay } from "lucide-react";

import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { formatNumber, proxyImageUrl } from "@/lib/utils";
import type { DouyinAccountDetailDTO } from "@/types/douyin-account";

import { AccountLoginStatusBadge } from "./account-login-status-badge";
import { AccountSyncSection } from "./account-sync-section";
import { getAccountSummaryFallback } from "./accounts-copy";

interface AccountDetailHeaderProps {
  account: DouyinAccountDetailDTO;
  canRelogin: boolean;
  onSyncSuccess: (newLastSyncedAt: string) => void;
  onReloginOpen: () => void;
}

export function AccountDetailHeader({
  account,
  canRelogin,
  onSyncSuccess,
  onReloginOpen,
}: AccountDetailHeaderProps) {
  const location = [account.province, account.city].filter(Boolean).join("  ");
  const showVerification = Boolean(account.verificationLabel);
  const summary = account.signature ?? account.bio ?? getAccountSummaryFallback();
  const statCards = [
    { label: "关注", value: formatNumber(account.followingCount) },
    { label: "粉丝", value: formatNumber(account.followersCount) },
    { label: "获赞", value: formatNumber(account.likesCount) },
  ];
  const profileMetaItems = [
    { label: "内容源账号", icon: MonitorPlay, tone: "primary" as const },
    ...(account.douyinNumber ? [{ label: `@${account.douyinNumber}` }] : []),
  ];
  const locationMetaItems = [
    ...(account.ipLocation ? [{ label: account.ipLocation, icon: MapPin }] : []),
    ...(account.age !== null ? [{ label: `${account.age} 岁` }] : []),
    ...(location ? [{ label: location }] : []),
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_36%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.08),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.16]" />

      <div className="relative space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)] xl:items-start">
          <div className="space-y-5">
            <div className="flex items-start gap-4 sm:gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proxyImageUrl(account.avatar)}
                alt={account.nickname}
                className="h-20 w-20 shrink-0 rounded-full border border-border/60 bg-muted object-cover sm:h-24 sm:w-24"
              />
              <div className="min-w-0 flex-1 space-y-3">
                <MetaPillList items={profileMetaItems} />

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground/95">
                      {account.nickname}
                    </h2>
                    <AccountLoginStatusBadge status={account.loginStatus} />
                    {showVerification ? (
                      <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[hsl(var(--warning)/0.25)] bg-[hsl(var(--warning)/0.12)] px-2.5 py-1 text-2xs text-[hsl(var(--warning))]">
                        {account.verificationIconUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={account.verificationIconUrl}
                            alt="认证"
                            className="h-3.5 w-3.5 shrink-0 object-contain"
                          />
                        ) : (
                          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[hsl(var(--warning))] text-[9px] font-bold text-background">
                            V
                          </span>
                        )}
                        <span className="truncate">{account.verificationLabel}</span>
                      </div>
                    ) : null}
                  </div>
                  <p className="max-w-3xl text-base leading-7 text-muted-foreground/85">{summary}</p>
                </div>

                <MetaPillList items={locationMetaItems} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {statCards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
                  <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/75">{card.label}</p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-foreground/95">{card.value}</p>
                </div>
              ))}
            </div>
          </div>

          <AccountSyncSection
            accountId={account.id}
            lastSyncedAt={account.lastSyncedAt}
            onSyncSuccess={onSyncSuccess}
            canRelogin={canRelogin}
            onReloginOpen={onReloginOpen}
          />
        </div>
      </div>
    </section>
  );
}