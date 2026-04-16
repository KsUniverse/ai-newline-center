"use client";

import { Archive, Clock3, Orbit, ScanSearch } from "lucide-react";

import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatNumber, formatRelativeTime, proxyImageUrl } from "@/lib/utils";
import type { BenchmarkAccountDetailDTO } from "@/types/douyin-account";

import {
  getBenchmarkArchiveActionLabel,
  getBenchmarkCardSummaryFallback,
  getBenchmarkCreatedByLabel,
} from "./benchmark-copy";

interface BenchmarkDetailHeaderProps {
  account: BenchmarkAccountDetailDTO;
  onArchive?: () => void;
}

export function BenchmarkDetailHeader({
  account,
  onArchive,
}: BenchmarkDetailHeaderProps) {
  const isArchived = account.deletedAt != null;
  const canArchive = !isArchived && account.canArchive && Boolean(onArchive);
  const location = [account.province, account.city].filter(Boolean).join(" · ");
  const showVerification = Boolean(account.verificationLabel);
  const summary = account.signature ?? account.bio ?? getBenchmarkCardSummaryFallback();
  const statCards = [
    { label: "粉丝", value: formatNumber(account.followersCount) },
    { label: "关注", value: formatNumber(account.followingCount) },
    { label: "获赞", value: formatNumber(account.likesCount) },
  ];
  const profileMetaItems = [
    { label: "对标账号", icon: ScanSearch, tone: "primary" as const },
    ...(isArchived && account.deletedAt
      ? [{ label: `归档于 ${formatDateTime(account.deletedAt)}` }]
      : [{ label: "Active 档案", tone: "success" as const }]),
    ...(account.douyinNumber ? [{ label: `${account.douyinNumber}` }] : []),
  ];
  const locationMetaItems = [
    ...(account.ipLocation ? [{ label: account.ipLocation }] : []),
    ...(account.age !== null ? [{ label: `${account.age} 岁` }] : []),
    ...(location ? [{ label: location, icon: Orbit }] : []),
  ];
  const activityMetaItems = [
    { label: getBenchmarkCreatedByLabel(account.creatorName) },
    ...(account.lastSyncedAt
      ? [{ label: `最近同步 ${formatRelativeTime(account.lastSyncedAt)}`, icon: Clock3 }]
      : [{ label: "等待首次同步", icon: Clock3 }]),
    { label: `录入于 ${formatRelativeTime(account.createdAt)}` },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_36%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.08),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.16]" />

      <div className="relative space-y-5">
        <div className="flex items-start gap-4 sm:gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proxyImageUrl(account.avatar)}
            alt={account.nickname}
            className="h-20 w-20 shrink-0 rounded-full border border-border/60 bg-muted object-cover sm:h-24 sm:w-24"
          />

          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <MetaPillList items={profileMetaItems} className="min-w-0" />

              {canArchive ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 rounded-full px-4 text-sm shadow-sm"
                  onClick={onArchive}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  {getBenchmarkArchiveActionLabel()}
                </Button>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground/95">
                  {account.nickname}
                </h2>
                {showVerification ? (
                  <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-2xs text-primary">
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

              <p className="max-w-3xl text-base leading-7 text-muted-foreground/85">
                {summary}
              </p>
            </div>

            <MetaPillList items={locationMetaItems} />
            <MetaPillList items={activityMetaItems} />

            {!isArchived && !account.canArchive ? (
              <p className="text-sm leading-6 text-muted-foreground/75">
                当前可继续查看资料与样本；仅关联成员可执行归档。
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm"
            >
              <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/75">
                {card.label}
              </p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-foreground/95">
                {card.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
