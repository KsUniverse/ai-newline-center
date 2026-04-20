import { Archive, RefreshCw, Sparkles, Users } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  getBenchmarkArchiveHint,
  getBenchmarkLibraryCountLabel,
  getBenchmarkLibraryOverviewDescription,
  getBenchmarkLibraryOverviewTitle,
  getBenchmarkLibrarySyncHint,
} from "./benchmark-copy";

interface BenchmarkLibraryOverviewProps {
  total: number;
  archived?: boolean;
}

export function BenchmarkLibraryOverview({
  total,
  archived = false,
}: BenchmarkLibraryOverviewProps) {
  const statCards = [
    {
      icon: archived ? Archive : Sparkles,
      label: archived ? "归档数量" : "在库数量",
      value: getBenchmarkLibraryCountLabel(total, archived),
      description: archived
        ? "历史对象仍保留素材、指标与转录记录。"
        : "组织内共享同一份研究档案，避免重复沉淀。",
    },
    {
      icon: Users,
      label: "成员语义",
      value: archived ? "仍按组织共享" : "新增成员只建立关联",
      description: "creatorName 仅用于展示最初录入来源，不再代表操作权限。",
    },
    {
      icon: RefreshCw,
      label: archived ? "回溯价值" : "归档权限",
      value: archived ? getBenchmarkLibrarySyncHint(true) : getBenchmarkArchiveHint(),
      description: archived
        ? "适合追溯素材来源、历史判断和曾经的研究样本。"
        : "前端统一提供入口，最终以后端成员关系校验为准。",
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-xl border border-border/55 bg-card/90 p-5 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_36%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.08),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.14]" />

      <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:items-end">
        <div className="space-y-3">
          <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
            {archived ? "Research Archive" : "Shared Signals"}
          </p>
          <div className="space-y-2">
            <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-foreground/95 sm:text-3xl">
              {getBenchmarkLibraryOverviewTitle(archived)}
            </h2>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground/85">
              {getBenchmarkLibraryOverviewDescription(archived)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          {statCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className={cn(
                  "rounded-lg border border-border/55 bg-background/80 p-4",
                  "bg-background/80",
                )}
              >
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