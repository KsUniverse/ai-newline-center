"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { ACCOUNTS_ADD_ACTION_LABEL } from "./accounts-copy";
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
        <SheetHeader className="border-b border-border/35 px-6 py-6 text-left">
          <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
            Source Intake
          </p>
          <SheetTitle>{ACCOUNTS_ADD_ACTION_LABEL}</SheetTitle>
          <SheetDescription>
            默认通过抖音扫码接入内容账号，并为其绑定独立登录态与同步链路。
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-6">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
