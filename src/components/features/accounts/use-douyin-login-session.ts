"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api-client";
import { douyinLoginSessionClient } from "@/lib/douyin-login-session-client";
import type {
  CreateDouyinLoginSessionInput,
  DouyinLoginSessionDTO,
  DouyinLoginSessionPurpose,
} from "@/types/douyin-account";

import {
  isDouyinLoginSessionTerminal,
  mapLoginSessionToViewState,
  type AccountLoginViewState,
} from "./account-login-status-copy";

interface UseDouyinLoginSessionOptions {
  purpose: DouyinLoginSessionPurpose;
  accountId?: string;
  autoStartKey?: string | null;
  pollIntervalMs?: number;
  onSuccess?: (session: DouyinLoginSessionDTO) => void;
}

interface CancelSessionOptions {
  silent?: boolean;
}

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

export function useDouyinLoginSession({
  purpose,
  accountId,
  autoStartKey = null,
  pollIntervalMs = 5000,
  onSuccess,
}: UseDouyinLoginSessionOptions) {
  const [session, setSession] = useState<DouyinLoginSessionDTO | null>(null);
  const [viewState, setViewState] = useState<AccountLoginViewState>("IDLE");
  const [isStarting, setIsStarting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);

  const sessionRef = useRef<DouyinLoginSessionDTO | null>(null);
  const autoStartedKeyRef = useRef<string | null>(null);
  const successHandledRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef(false);

  const applySession = useCallback(
    (nextSession: DouyinLoginSessionDTO | null, creatingSession: boolean = false) => {
      sessionRef.current = nextSession;
      setSession(nextSession);
      setViewState(mapLoginSessionToViewState(nextSession, creatingSession));

      if (nextSession?.status === "SUCCESS") {
        if (!successHandledRef.current) {
          successHandledRef.current = true;
          onSuccess?.(nextSession);
        }
        return;
      }

      successHandledRef.current = false;
    },
    [onSuccess],
  );

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearPollTimer();
    sessionRef.current = null;
    successHandledRef.current = false;
    isPollingRef.current = false;
    setSession(null);
    setViewState("IDLE");
    setIsStarting(false);
    setIsRefreshing(false);
    setIsCancelling(false);
    setPollError(null);
  }, [clearPollTimer]);

  const startSession = useCallback(async () => {
    if (isStarting) {
      return;
    }

    clearPollTimer();
    setPollError(null);
    setIsStarting(true);
    applySession(null, true);

    try {
      const nextSession =
        purpose === "RELOGIN"
          ? accountId
            ? await douyinLoginSessionClient.relogin(accountId)
            : null
          : await douyinLoginSessionClient.createSession({
              purpose,
            } satisfies CreateDouyinLoginSessionInput);

      if (!nextSession) {
        throw new Error("缺少重登录账号标识");
      }

      applySession(nextSession);
    } catch (error) {
      setViewState("FAILED");
      setPollError(getApiErrorMessage(error, "创建登录会话失败，请重试"));
    } finally {
      setIsStarting(false);
    }
  }, [accountId, applySession, clearPollTimer, isStarting, purpose]);

  const refreshSession = useCallback(async () => {
    const currentSession = sessionRef.current;

    if (!currentSession?.id) {
      await startSession();
      return;
    }

    setIsRefreshing(true);
    setPollError(null);

    try {
      const nextSession = await douyinLoginSessionClient.refreshSession(currentSession.id);
      applySession(nextSession);
    } catch (error) {
      setPollError(getApiErrorMessage(error, "刷新二维码失败，请重试"));
    } finally {
      setIsRefreshing(false);
    }
  }, [applySession, startSession]);

  const cancelSession = useCallback(
    async (options?: CancelSessionOptions) => {
      const currentSession = sessionRef.current;

      if (!currentSession?.id || isDouyinLoginSessionTerminal(currentSession.status)) {
        return;
      }

      setIsCancelling(true);

      try {
        const nextSession = await douyinLoginSessionClient.cancelSession(currentSession.id);
        applySession(nextSession);
      } catch (error) {
        if (!options?.silent) {
          setPollError(getApiErrorMessage(error, "取消登录失败，请稍后重试"));
        }
      } finally {
        setIsCancelling(false);
      }
    },
    [applySession],
  );

  useEffect(() => {
    if (!autoStartKey) {
      autoStartedKeyRef.current = null;
      return;
    }

    if (autoStartedKeyRef.current === autoStartKey || isStarting || session) {
      return;
    }

    autoStartedKeyRef.current = autoStartKey;
    void startSession();
  }, [autoStartKey, isStarting, session, startSession]);

  useEffect(() => {
    const currentSession = sessionRef.current;

    if (!currentSession?.id || isStarting || isDouyinLoginSessionTerminal(currentSession.status)) {
      clearPollTimer();
      return;
    }

    pollTimerRef.current = setTimeout(() => {
      if (isPollingRef.current) {
        return;
      }

      isPollingRef.current = true;

      void douyinLoginSessionClient
        .getSession(currentSession.id)
        .then((nextSession) => {
          setPollError(null);
          applySession(nextSession);
        })
        .catch((error: unknown) => {
          setPollError(getApiErrorMessage(error, "登录状态刷新失败，请检查网络后重试"));
        })
        .finally(() => {
          isPollingRef.current = false;
        });
    }, pollIntervalMs);

    return clearPollTimer;
  }, [applySession, clearPollTimer, isStarting, pollIntervalMs, session]);

  useEffect(() => clearPollTimer, [clearPollTimer]);

  return {
    session,
    viewState,
    isStarting,
    isRefreshing,
    isCancelling,
    pollError,
    startSession,
    refreshSession,
    cancelSession,
    reset,
  };
}
