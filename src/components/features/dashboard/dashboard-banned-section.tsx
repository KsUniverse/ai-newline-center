"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BanIcon, Search, ShieldOff, UserX } from "lucide-react";

import { SurfaceSection } from "@/components/shared/common/surface-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { dashboardApi } from "@/lib/api-client";
import {
  BANNED_DATE_RANGE_LABELS,
  formatBannedAt,
  type BannedAccountItem,
  type BannedDateRangeToken,
  type SearchAccountItem,
} from "@/types/benchmark-video";
import { cn } from "@/lib/utils";

export function DashboardBannedSection() {
  const [dateRange, setDateRange] = useState<BannedDateRangeToken>("this_week");
  const [items, setItems] = useState<BannedAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markBanOpen, setMarkBanOpen] = useState(false);

  const fetchBannedAccounts = useCallback(async (range: BannedDateRangeToken) => {
    setLoading(true);
    try {
      const result = await dashboardApi.getBannedAccounts(range);
      setItems(result.items);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBannedAccounts(dateRange);
  }, [dateRange, fetchBannedAccounts]);

  const handleUnban = async (accountId: string) => {
    const prevItems = items;
    setItems((prev) => prev.filter((item) => item.id !== accountId));
    try {
      await dashboardApi.updateAccountBan(accountId, false);
    } catch {
      setItems(prevItems);
    }
  };

  const handleMarkBanSuccess = () => {
    setMarkBanOpen(false);
    void fetchBannedAccounts(dateRange);
  };

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {/* 日期 Tab */}
      <div className="flex rounded-lg border border-border/60 bg-muted/40 p-0.5">
        {(Object.keys(BANNED_DATE_RANGE_LABELS) as BannedDateRangeToken[]).map((key) => (
          <button
            key={key}
            onClick={() => setDateRange(key)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              dateRange === key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {BANNED_DATE_RANGE_LABELS[key]}
          </button>
        ))}
      </div>

      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-sm"
        onClick={() => setMarkBanOpen(true)}
      >
        <BanIcon className="h-3.5 w-3.5" />
        标记封禁
      </Button>
    </div>
  );

  return (
    <>
      <SurfaceSection eyebrow="Ban Monitor" title="封禁账号" actions={actions}>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            加载中…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <ShieldOff className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">该时间段暂无封禁账号</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {items.map((account) => (
              <BannedAccountRow
                key={account.id}
                account={account}
                onUnban={() => void handleUnban(account.id)}
              />
            ))}
          </div>
        )}
      </SurfaceSection>

      <MarkBanDialog
        open={markBanOpen}
        onOpenChange={setMarkBanOpen}
        onSuccess={handleMarkBanSuccess}
      />
    </>
  );
}

interface BannedAccountRowProps {
  account: BannedAccountItem;
  onUnban: () => void;
}

function BannedAccountRow({ account, onUnban }: BannedAccountRowProps) {
  const [avatarError, setAvatarError] = useState(false);

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      {/* 头像 */}
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border/40 bg-muted">
        {account.avatar && !avatarError ? (
          <Image
            src={account.avatar}
            alt={account.nickname}
            fill
            className="object-cover"
            onError={() => setAvatarError(true)}
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UserX className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* 信息 */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground/90">
          {account.nickname}
        </p>
        <p className="text-xs text-muted-foreground">
          {account.douyinNumber ?? "—"} · {formatBannedAt(account.bannedAt)}
        </p>
      </div>

      {/* 取消封禁 */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 shrink-0 text-xs text-muted-foreground hover:text-foreground"
        onClick={onUnban}
      >
        取消封禁
      </Button>
    </div>
  );
}

interface MarkBanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function MarkBanDialog({ open, onOpenChange, onSuccess }: MarkBanDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchAccountItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchAccountItem | null>(null);
  const [confirming, setConfirming] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelected(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await dashboardApi.searchAccounts(value.trim());
        setResults(result.items);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleConfirm = async () => {
    if (!selected) return;
    setConfirming(true);
    try {
      await dashboardApi.updateAccountBan(selected.id, true);
      onSuccess();
      setQuery("");
      setResults([]);
      setSelected(null);
    } catch {
      // silently fail
    } finally {
      setConfirming(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setQuery("");
      setResults([]);
      setSelected(null);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>标记封禁</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="按昵称或抖音号搜索…"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
            />
          </div>

          {searching && (
            <p className="text-center text-sm text-muted-foreground">搜索中…</p>
          )}

          {!searching && results.length > 0 && (
            <div className="max-h-56 divide-y divide-border/40 overflow-y-auto rounded-xl border border-border/60">
              {results.map((account) => (
                <button
                  key={account.id}
                  onClick={() => setSelected(account)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                    selected?.id === account.id && "bg-primary/10",
                  )}
                >
                  <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-border/40 bg-muted">
                    {account.avatar ? (
                      <Image
                        src={account.avatar}
                        alt={account.nickname}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <UserX className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{account.nickname}</p>
                    <p className="text-xs text-muted-foreground">{account.douyinNumber ?? "—"}</p>
                  </div>
                  {account.isBanned && (
                    <span className="shrink-0 text-xs text-destructive">已封禁</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {!searching && query.trim() && results.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">未找到匹配账号</p>
          )}

          {selected?.isBanned && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              该账号已被标记为封禁
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
              取消
            </Button>
            <Button
              size="sm"
              disabled={!selected || selected.isBanned || confirming}
              onClick={() => void handleConfirm()}
            >
              {confirming ? "处理中…" : "确认封禁"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
