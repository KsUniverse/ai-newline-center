"use client";

import type {
  DouyinLoginSessionDTO,
  DouyinLoginSessionPurpose,
} from "@/types/douyin-account";

import type { AccountLoginViewState } from "./account-login-status-copy";
import { AccountLoginQrcodePanel } from "./account-login-qrcode-panel";

interface AccountLoginSessionContentProps {
  purpose: DouyinLoginSessionPurpose;
  viewState: AccountLoginViewState;
  session: DouyinLoginSessionDTO | null;
  isStarting: boolean;
  isRefreshing: boolean;
  isCancelling: boolean;
  pollError: string | null;
  onRetry: () => void;
  onRefresh: () => void;
  onCancel: () => void;
}

export function AccountLoginSessionContent({
  purpose,
  viewState,
  session,
  isStarting,
  isRefreshing,
  isCancelling,
  pollError,
  onRetry,
  onRefresh,
  onCancel,
}: AccountLoginSessionContentProps) {
  return (
    <div className="mt-6">
      <AccountLoginQrcodePanel
        purpose={purpose}
        viewState={viewState}
        session={session}
        isStarting={isStarting}
        isRefreshing={isRefreshing}
        isCancelling={isCancelling}
        pollError={pollError}
        onRetry={onRetry}
        onRefresh={onRefresh}
        onCancel={onCancel}
      />
    </div>
  );
}
