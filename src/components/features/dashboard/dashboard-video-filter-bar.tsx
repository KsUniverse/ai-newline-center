"use client";

import { ArrowUpDown, Filter, Hash, ShoppingBag } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_VIDEO_SORT_LABELS,
  BENCHMARK_VIDEO_TAG_LABELS,
  BENCHMARK_VIDEO_TAG_VALUES,
  DATE_RANGE_LABELS,
  type DashboardVideoSortBy,
  type BenchmarkVideoTag,
  type DateRangeToken,
} from "@/types/benchmark-video";

interface DashboardVideoFilterBarProps {
  dateRange: DateRangeToken;
  sortBy: DashboardVideoSortBy;
  customTag: BenchmarkVideoTag | "ALL";
  isBringOrder: "all" | "true" | "false";
  onDateRangeChange: (value: DateRangeToken) => void;
  onSortByChange: (value: DashboardVideoSortBy) => void;
  onCustomTagChange: (value: BenchmarkVideoTag | "ALL") => void;
  onBringOrderChange: (value: "all" | "true" | "false") => void;
}

export function DashboardVideoFilterBar({
  dateRange,
  sortBy,
  customTag,
  isBringOrder,
  onDateRangeChange,
  onSortByChange,
  onCustomTagChange,
  onBringOrderChange,
}: DashboardVideoFilterBarProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-2.5 py-0.5 text-sm text-muted-foreground shadow-sm">
          <Filter className="h-3.5 w-3.5" />
          <span>筛选条件</span>
        </div>

        <div className="inline-flex rounded-xl border border-border/60 bg-card/80 p-0.5 shadow-sm">
          {(Object.keys(DATE_RANGE_LABELS) as DateRangeToken[]).map((key) => (
            <button
              key={key}
            type="button"
            onClick={() => onDateRangeChange(key)}
            className={cn(
              "rounded-lg px-3 py-1 text-sm font-medium transition-colors",
              dateRange === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
              )}
            >
              {DATE_RANGE_LABELS[key]}
            </button>
          ))}
        </div>

        <Select value={sortBy} onValueChange={(value) => onSortByChange(value as DashboardVideoSortBy)}>
          <SelectTrigger className="h-7.5 w-[9rem] border-border/60 bg-card text-sm shadow-sm">
            <ArrowUpDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(DASHBOARD_VIDEO_SORT_LABELS) as DashboardVideoSortBy[]).map((key) => (
              <SelectItem key={key} value={key}>
                {DASHBOARD_VIDEO_SORT_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={customTag} onValueChange={(value) => onCustomTagChange(value as BenchmarkVideoTag | "ALL")}>
          <SelectTrigger className="h-7.5 w-[9rem] border-border/60 bg-card text-sm shadow-sm">
            <Hash className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="全部标签" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部标签</SelectItem>
            {BENCHMARK_VIDEO_TAG_VALUES.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {BENCHMARK_VIDEO_TAG_LABELS[tag]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={isBringOrder} onValueChange={(value) => onBringOrderChange(value as "all" | "true" | "false")}>
          <SelectTrigger className="h-7.5 w-[9rem] border-border/60 bg-card text-sm shadow-sm">
            <ShoppingBag className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="全部带单" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部带单</SelectItem>
            <SelectItem value="true">仅带单</SelectItem>
            <SelectItem value="false">仅未带单</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
