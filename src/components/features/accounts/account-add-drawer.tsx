"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { AccountLoginSessionContent } from "./account-login-session-content";
import { useAccountLoginSessionController } from "./use-account-login-session-controller";

interface AccountAddDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AccountAddDrawer({ open, onOpenChange, onSuccess }: AccountAddDrawerProps) {
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
    purpose: "CREATE_ACCOUNT",
    open,
    autoStartKey: "create-account:qrcode",
    successMessage: "账号已创建",
    onOpenChange,
    onSuccess,
  });

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>添加账号</SheetTitle>
          <SheetDescription>
            默认通过抖音扫码自动建号，并为账号绑定独立登录态。
          </SheetDescription>
        </SheetHeader>

        <AccountLoginSessionContent
          purpose="CREATE_ACCOUNT"
          viewState={viewState}
          session={session}
          isStarting={isStarting}
          isRefreshing={isRefreshing}
          isCancelling={isCancelling}
          pollError={pollError}
          infoTitle="当前交付范围"
          infoDescription={
            <>
              当前版本只保留扫码自动建号主流程，登录后仅通过
              <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">aweme/favorite</code>
              请求识别账号身份与 Cookie。
            </>
          }
          notes={[
            {
              title: "自动建号",
              description: "扫码确认后会自动创建 MY_ACCOUNT，并绑定独立登录态。",
            },
            {
              title: "失败即回滚",
              description: "若无法识别 secUserId 或 Cookie，会话会直接失败，不保留半成品账号。",
            },
            {
              title: "账号隔离",
              description: "一个员工连续录入多个账号时，每个账号都拥有各自独立的登录态。",
            },
          ]}
          onRetry={handleRetry}
          onRefresh={handleRefresh}
          onCancel={handleCancel}
        />
      </SheetContent>
    </Sheet>
  );
}
