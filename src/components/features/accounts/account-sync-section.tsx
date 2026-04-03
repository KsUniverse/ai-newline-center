"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiClient, ApiError } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";

interface AccountSyncSectionProps {
  accountId: string;
  lastSyncedAt: string | null;
  onSyncSuccess: (newLastSyncedAt: string) => void;
}

export function AccountSyncSection({
  accountId,
  lastSyncedAt,
  onSyncSuccess,
}: AccountSyncSectionProps) {
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const data = await apiClient.post<{ lastSyncedAt: string }>(
        `/douyin-accounts/${accountId}/sync`,
      );
      onSyncSuccess(data.lastSyncedAt);
      toast.success("同步成功");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "同步失败，请稍后再试";
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground">
        最后同步时间：{formatRelativeTime(lastSyncedAt)}
      </span>
      <Button size="sm" variant="outline" disabled={syncing} onClick={handleSync}>
        {syncing ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            同步中…
          </>
        ) : (
          <>
            <RefreshCw className="h-3 w-3" />
            立即同步
          </>
        )}
      </Button>
    </div>
  );
}
