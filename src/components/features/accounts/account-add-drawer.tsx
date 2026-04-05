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
          onRetry={handleRetry}
          onRefresh={handleRefresh}
          onCancel={handleCancel}
        />
      </SheetContent>
    </Sheet>
  );
}
