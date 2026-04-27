"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ai_direct_create_state";

export interface DirectCreateLocalState {
  currentRewriteId: string | null;
  fragmentIds: string[];
  userInputContent: string;
  topic: string;
  modelConfigId: string | null;
  targetAccountId: string | null;
}

export const DIRECT_CREATE_DEFAULT_STATE: DirectCreateLocalState = {
  currentRewriteId: null,
  fragmentIds: [],
  userInputContent: "",
  topic: "",
  modelConfigId: null,
  targetAccountId: null,
};

function normalizeState(value: unknown): DirectCreateLocalState {
  if (!value || typeof value !== "object") {
    return DIRECT_CREATE_DEFAULT_STATE;
  }

  const record = value as Partial<DirectCreateLocalState>;
  return {
    currentRewriteId:
      typeof record.currentRewriteId === "string" ? record.currentRewriteId : null,
    fragmentIds: Array.isArray(record.fragmentIds)
      ? record.fragmentIds.filter((id): id is string => typeof id === "string")
      : [],
    userInputContent:
      typeof record.userInputContent === "string" ? record.userInputContent : "",
    topic: typeof record.topic === "string" ? record.topic : "",
    modelConfigId:
      typeof record.modelConfigId === "string" ? record.modelConfigId : null,
    targetAccountId:
      typeof record.targetAccountId === "string" ? record.targetAccountId : null,
  };
}

export function loadDirectCreateStateFromStorage(): DirectCreateLocalState {
  if (typeof window === "undefined") {
    return DIRECT_CREATE_DEFAULT_STATE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : DIRECT_CREATE_DEFAULT_STATE;
  } catch {
    return DIRECT_CREATE_DEFAULT_STATE;
  }
}

export function saveDirectCreateStateToStorage(state: DirectCreateLocalState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useDirectCreateLocalState() {
  const [state, setState] = useState<DirectCreateLocalState>(DIRECT_CREATE_DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadDirectCreateStateFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    saveDirectCreateStateToStorage(state);
  }, [hydrated, state]);

  const update = useCallback((patch: Partial<DirectCreateLocalState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearCurrentTask = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentRewriteId: null,
    }));
  }, []);

  return {
    state,
    hydrated,
    setCurrentRewriteId: (currentRewriteId: string | null) => update({ currentRewriteId }),
    setFragmentIds: (fragmentIds: string[]) => update({ fragmentIds }),
    setUserInputContent: (userInputContent: string) => update({ userInputContent }),
    setTopic: (topic: string) => update({ topic }),
    setModelConfigId: (modelConfigId: string | null) => update({ modelConfigId }),
    setTargetAccountId: (targetAccountId: string | null) => update({ targetAccountId }),
    clearCurrentTask,
  };
}
