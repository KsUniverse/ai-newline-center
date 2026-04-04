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
      <DialogContent className="max-w-xl border-border/60 bg-card p-0">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle>{reloginLabel}</DialogTitle>
            <DialogDescription>
              为当前账号更新独立登录态，不会影响其他已录入账号。
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-6 pb-6">
          <AccountLoginSessionContent
            purpose="RELOGIN"
            viewState={viewState}
            session={session}
            isStarting={isStarting}
            isRefreshing={isRefreshing}
            isCancelling={isCancelling}
            pollError={pollError}
            infoTitle="本次重登录说明"
            infoDescription="本次扫码只会更新当前账号自己的正式登录态，不会影响你名下其他已录入账号。"
            notes={[
              {
                title: "只更新当前账号",
                description: "重登录成功后，仅覆盖当前账号自己的正式登录态文件。",
              },
              {
                title: "扫错号会拦截",
                description: "若本次扫码账号与目标 secUserId 不一致，系统会失败并保持原登录态不被覆盖。",
              },
              {
                title: "失败后可重试",
                description: "二维码过期、手机取消或会话失败时，前端会保留重试、刷新和取消入口。",
              },
            ]}
            onRetry={handleRetry}
            onRefresh={handleRefresh}
            onCancel={handleCancel}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}