"use client";

import { useCallback, useEffect, useState } from "react";
import { Filter } from "lucide-react";
import { toast } from "sonner";

import { SurfaceSection } from "@/components/shared/common/surface-section";
import { dashboardApi } from "@/lib/api-client";
import {
  BANNED_DATE_RANGE_LABELS,
  type BannedAccountItem,
  type BannedDateRangeToken,
} from "@/types/benchmark-video";
import { cn } from "@/lib/utils";

import {
  getBannedFetchErrorMessage,
  getBannedSectionDescription,
} from "./dashboard-copy";
import { DashboardBannedGrid } from "./dashboard-banned-grid";

export function DashboardBannedSection() {
  const [dateRange, setDateRange] = useState<BannedDateRangeToken>("this_week");
  const [items, setItems] = useState<BannedAccountItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBannedAccounts = useCallback(async (range: BannedDateRangeToken) => {
    setLoading(true);
    try {
      const result = await dashboardApi.getBannedAccounts(range);
      setItems(result.items);
    } catch {
      toast.error(getBannedFetchErrorMessage());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBannedAccounts(dateRange);
  }, [dateRange, fetchBannedAccounts]);

  const actions = (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-2.5 py-0.5 text-sm text-muted-foreground shadow-sm">
          <Filter className="h-3.5 w-3.5" />
          <span>筛选条件</span>
        </div>

        <div className="inline-flex rounded-xl border border-border/60 bg-card/80 p-0.5 shadow-sm">
          {(Object.keys(BANNED_DATE_RANGE_LABELS) as BannedDateRangeToken[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setDateRange(key)}
              className={cn(
                "rounded-lg px-3 py-1 text-sm font-medium transition-colors",
                dateRange === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
              )}
            >
              {BANNED_DATE_RANGE_LABELS[key]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <SurfaceSection
        eyebrow="Ban Monitor"
        title="封禁账号"
        description={getBannedSectionDescription(dateRange, items.length)}
        actions={actions}
      >
        <DashboardBannedGrid
          items={items}
          loading={loading}
        />
      </SurfaceSection>
    </>
  );
}
