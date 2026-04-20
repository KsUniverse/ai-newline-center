"use client";

import { ShieldOff } from "lucide-react";

import { type BannedAccountItem } from "@/types/benchmark-video";

import { DashboardBannedCard } from "./dashboard-banned-card";

interface DashboardBannedGridProps {
  items: BannedAccountItem[];
  loading: boolean;
}

export function DashboardBannedGrid({
  items,
  loading,
}: DashboardBannedGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-64 animate-pulse rounded-xl border border-border/55 bg-card/80"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-background/60 px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border/55 bg-card">
          <ShieldOff className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground/90">当前没有封禁账号</h3>
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground/80">
          你可以切换日期范围，查看其他时间段内由系统自动识别出的封禁账号。
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
      {items.map((account) => (
        <DashboardBannedCard
          key={account.id}
          account={account}
        />
      ))}
    </div>
  );
}
