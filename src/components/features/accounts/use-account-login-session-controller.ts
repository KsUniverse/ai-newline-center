"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import type { DouyinLoginSessionPurpose } from "@/types/douyin-account";

import { useDouyinLoginSession } from "./use-douyin-login-session";

interface UseAccountLoginSessionControllerOptions {
  purpose: DouyinLoginSessionPurpose;
  open: boolean;
  accountId?: string;
  autoStartKey: string | null;
  successMessage: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function useAccountLoginSessionController({
  purpose,
  open,
  accountId,
  autoStartKey,
  successMessage,
  onOpenChange,
  onSuccess,
}: UseAccountLoginSessionControllerOptions) {
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loginSession = useDouyinLoginSession({
    purpose,
    accountId,
    autoStartKey: open ? autoStartKey : null,
    onSuccess: () => {
      toast.success(successMessage);
      onSuccess();
      closeTimerRef.current = setTimeout(() => {
        onOpenChange(false);
        loginSession.reset();
      }, 900);
    },
  });

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onOpenChange(false);
        void loginSession.cancelSession({ silent: true }).finally(() => {
          loginSession.reset();
        });
        return;
      }

      onOpenChange(true);
    },
    [loginSession, onOpenChange],
  );

  const handleRetry = useCallback(() => {
    void loginSession.startSession();
  }, [loginSession]);

  const handleRefresh = useCallback(() => {
    void loginSession.refreshSession();
  }, [loginSession]);

  const handleCancel = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  return {
    ...loginSession,
    handleOpenChange,
    handleRetry,
    handleRefresh,
    handleCancel,
  };
}