"use client";

import type { DouyinAccountDetailDTO } from "@/types/douyin-account";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { AccountLoginSessionContent } from "./account-login-session-content";
import { getReloginActionLabel } from "./account-login-status-copy";
import { useAccountLoginSessionController } from "./use-account-login-session-controller";

interface AccountReloginDialogProps {
  account: DouyinAccountDetailDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AccountReloginDialog({
  account,
  open,
  onOpenChange,
  onSuccess,
}: AccountReloginDialogProps) {
  const reloginLabel = getReloginActionLabel(account.loginStatus);
  const {
    session,
    viewState,
    isStarting,
    isRefreshing,
    isCancelling,
    pollError,
    handleOpenChange,
    handleRetry,
    handleRefresh,
    handleCancel,
  } = useAccountLoginSessionController({
    purpose: "RELOGIN",
    open,
    accountId: account.id,
    autoStartKey: `relogin:${account.id}`,
    successMessage: "登录态已更新",
    onOpenChange,
    onSuccess,
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl border-border/55 bg-card/95 p-0">
        <div className="border-b border-border/35 px-6 py-6">
          <DialogHeader>
            <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
              Login Session
            </p>
            <DialogTitle>{reloginLabel}</DialogTitle>
            <DialogDescription>
              为当前账号更新独立登录态，不会影响其他已录入账号。
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-6 py-6">
          <AccountLoginSessionContent
            purpose="RELOGIN"
            viewState={viewState}
            session={session}
            isStarting={isStarting}
            isRefreshing={isRefreshing}
            isCancelling={isCancelling}
            pollError={pollError}
            onRetry={handleRetry}
            onRefresh={handleRefresh}
            onCancel={handleCancel}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
