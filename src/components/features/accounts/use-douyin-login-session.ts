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
  onSuccess?: (session: DouyinLoginSessionDTO) => void;
}

interface CancelSessionOptions {
  silent?: boolean;
}

interface SessionStreamPayload {
  session: DouyinLoginSessionDTO;
}

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

export function useDouyinLoginSession({
  purpose,
  accountId,
  autoStartKey = null,
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
  const eventSourceRef = useRef<EventSource | null>(null);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const applySession = useCallback(
    (nextSession: DouyinLoginSessionDTO | null, creatingSession: boolean = false) => {
      sessionRef.current = nextSession;
      setSession(nextSession);
      setViewState(mapLoginSessionToViewState(nextSession, creatingSession));

      if (nextSession?.status === "SUCCESS") {
        if (!successHandledRef.current) {
          successHandledRef.current = true;
          onSuccessRef.current?.(nextSession);
        }
        return;
      }

      successHandledRef.current = false;
    },
    [],
  );

  const closeEventSource = useCallback(() => {
    if (!eventSourceRef.current) {
      return;
    }

    eventSourceRef.current.close();
    eventSourceRef.current = null;
  }, []);

  const reset = useCallback(() => {
    closeEventSource();
    sessionRef.current = null;
    successHandledRef.current = false;
    setSession(null);
    setViewState("IDLE");
    setIsStarting(false);
    setIsRefreshing(false);
    setIsCancelling(false);
    setPollError(null);
  }, [closeEventSource]);

  const startSession = useCallback(async () => {
    if (isStarting) {
      return;
    }

    closeEventSource();
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
  }, [accountId, applySession, closeEventSource, isStarting, purpose]);

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
        closeEventSource();
      } catch (error) {
        if (!options?.silent) {
          setPollError(getApiErrorMessage(error, "取消登录失败，请稍后重试"));
        }
      } finally {
        setIsCancelling(false);
      }
    },
    [applySession, closeEventSource],
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
      closeEventSource();
      return;
    }

    const source = new EventSource(
      `/api/douyin-account-login-sessions/${currentSession.id}/sse`,
    );
    eventSourceRef.current = source;

    const handlePayload = (event: MessageEvent) => {
      const payload = JSON.parse(event.data as string) as SessionStreamPayload;
      setPollError(null);
      applySession(payload.session);

      if (isDouyinLoginSessionTerminal(payload.session.status)) {
        source.close();
        if (eventSourceRef.current === source) {
          eventSourceRef.current = null;
        }
      }
    };

    source.addEventListener("status", handlePayload);
    source.addEventListener("done", (event: Event) => {
      if (event instanceof MessageEvent) {
        handlePayload(event);
      }
      source.close();
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }
    });
    source.addEventListener("session-error", (event: Event) => {
      if (event instanceof MessageEvent) {
        try {
          const payload = JSON.parse(event.data as string) as SessionStreamPayload;
          applySession(payload.session);
        } catch {
          setPollError("登录状态同步失败，请稍后重试");
        }
        source.close();
        if (eventSourceRef.current === source) {
          eventSourceRef.current = null;
        }
      }
    });
    source.onerror = (event: Event) => {
      if (event instanceof MessageEvent) {
        return;
      }

      const currentSessionId = sessionRef.current?.id;
      if (!currentSessionId) {
        return;
      }

      void douyinLoginSessionClient
        .getSession(currentSessionId)
        .then((nextSession) => {
          setPollError(null);
          applySession(nextSession);

          if (isDouyinLoginSessionTerminal(nextSession.status)) {
            source.close();
            if (eventSourceRef.current === source) {
              eventSourceRef.current = null;
            }
          }
        })
        .catch((error: unknown) => {
          setPollError(
            getApiErrorMessage(error, "登录状态订阅已中断，请刷新二维码后重试"),
          );
        });
    };

    return () => {
      source.close();
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }
    };
  }, [applySession, closeEventSource, isStarting, session?.id]);

  useEffect(() => closeEventSource, [closeEventSource]);

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
