"use client";

import { useState } from "react";
import { Loader2, RefreshCw, LogIn } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiClient, ApiError } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";

import { getAccountSyncFailureMessage, getAccountSyncSuccessMessage } from "./accounts-copy";

interface AccountSyncSectionProps {
  accountId: string;
  lastSyncedAt: string | null;
  onSyncSuccess: (newLastSyncedAt: string) => void;
  canRelogin?: boolean;
  onReloginOpen?: () => void;
}

export function AccountSyncSection({
  accountId,
  lastSyncedAt,
  onSyncSuccess,
  canRelogin,
  onReloginOpen,
}: AccountSyncSectionProps) {
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const data = await apiClient.post<{ lastSyncedAt: string }>(
        `/douyin-accounts/${accountId}/sync`,
      );
      onSyncSuccess(data.lastSyncedAt);
      toast.success(getAccountSyncSuccessMessage());
    } catch (err) {
      const message = err instanceof ApiError ? err.message : getAccountSyncFailureMessage();
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">Sync Control</p>
          <p className="text-sm font-medium text-foreground/90">最近同步 {formatRelativeTime(lastSyncedAt)}</p>
          <p className="text-sm leading-6 text-muted-foreground/80">
            手动同步会刷新账号资料，并继续拉取最新视频样本与数据指标。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={syncing} onClick={handleSync} className="h-8 rounded-md px-3 text-sm">
            {syncing ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                同步中…
              </>
            ) : (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                立即同步
              </>
            )}
          </Button>
          {canRelogin && onReloginOpen ? (
            <Button size="sm" variant="outline" onClick={onReloginOpen} className="h-8 rounded-md px-3 text-sm">
              <LogIn className="mr-1.5 h-3.5 w-3.5" />
              更新登录
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
