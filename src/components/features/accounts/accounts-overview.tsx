import { MonitorPlay, RefreshCw, ShieldCheck } from "lucide-react";

import {
  getAccountsCountLabel,
  getAccountsOverviewDescription,
  getAccountsOverviewTitle,
  getAccountsScopeLabel,
  getAccountsSyncHint,
} from "./accounts-copy";

interface AccountsOverviewProps {
  total: number;
  role: string;
}

export function AccountsOverview({ total, role }: AccountsOverviewProps) {
  const statCards = [
    {
      icon: MonitorPlay,
      label: "账号规模",
      value: getAccountsCountLabel(total),
      description: "这些账号属于内容源链路，负责登录态、同步与发布数据采集。",
    },
    {
      icon: ShieldCheck,
      label: "查看范围",
      value: getAccountsScopeLabel(role),
      description: "我的账号链路与组织研究库分开管理，避免与 benchmark 语义混淆。",
    },
    {
      icon: RefreshCw,
      label: "同步节奏",
      value: getAccountsSyncHint(),
      description: "在账号档案内可以手动触发同步，也能查看最近一次同步时间。",
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_36%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.08),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.14]" />

      <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:items-end">
        <div className="space-y-3">
          <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
            Source Signals
          </p>
          <div className="space-y-2">
            <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-foreground/95 sm:text-3xl">
              {getAccountsOverviewTitle(role)}
            </h2>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground/85">
              {getAccountsOverviewDescription(role)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          {statCards.map((card) => {
            const Icon = card.icon;

            return (
              <div key={card.label} className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-primary">
                  <Icon className="h-4 w-4" />
                  <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/85">
                    {card.label}
                  </p>
                </div>
                <p className="mt-3 text-base font-semibold tracking-tight text-foreground/95">
                  {card.value}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground/75">{card.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}