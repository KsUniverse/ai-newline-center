"use client";

import { useCallback, useEffect, useState } from "react";

export interface RewriteLocalState {
  selectedFragmentIds: string[];
  modelConfigId: string | null;
  userInputContent: string;
  targetAccountId: string | null;
}

const INITIAL_STATE: RewriteLocalState = {
  selectedFragmentIds: [],
  modelConfigId: null,
  userInputContent: "",
  targetAccountId: null,
};

function getStorageKey(videoId: string): string {
  return `ai_rewrite_state_${videoId}`;
}

function loadFromStorage(videoId: string): RewriteLocalState {
  if (typeof window === "undefined") {
    return { ...INITIAL_STATE };
  }
  try {
    const raw = localStorage.getItem(getStorageKey(videoId));
    if (!raw) return { ...INITIAL_STATE };
    const parsed = JSON.parse(raw) as Partial<RewriteLocalState>;
    return {
      selectedFragmentIds: Array.isArray(parsed.selectedFragmentIds)
        ? (parsed.selectedFragmentIds as string[])
        : [],
      modelConfigId:
        typeof parsed.modelConfigId === "string" ? parsed.modelConfigId : null,
      userInputContent:
        typeof parsed.userInputContent === "string" ? parsed.userInputContent : "",
      targetAccountId:
        typeof parsed.targetAccountId === "string" ? parsed.targetAccountId : null,
    };
  } catch {
    return { ...INITIAL_STATE };
  }
}

function saveToStorage(videoId: string, state: RewriteLocalState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(videoId), JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function useRewriteLocalState(videoId: string | null): {
  state: RewriteLocalState;
  setSelectedFragmentIds: (ids: string[]) => void;
  setModelConfigId: (id: string | null) => void;
  setUserInputContent: (text: string) => void;
  setTargetAccountId: (id: string | null) => void;
  clearState: () => void;
} {
  const [state, setState] = useState<RewriteLocalState>(() => {
    if (!videoId) return { ...INITIAL_STATE };
    return loadFromStorage(videoId);
  });

  // When videoId changes, load fresh state from localStorage
  useEffect(() => {
    if (!videoId) {
      setState({ ...INITIAL_STATE });
      return;
    }
    setState(loadFromStorage(videoId));
  }, [videoId]);

  const setSelectedFragmentIds = useCallback(
    (ids: string[]) => {
      if (!videoId) return;
      setState((prev) => {
        const next = { ...prev, selectedFragmentIds: ids };
        saveToStorage(videoId, next);
        return next;
      });
    },
    [videoId],
  );

  const setModelConfigId = useCallback(
    (id: string | null) => {
      if (!videoId) return;
      setState((prev) => {
        const next = { ...prev, modelConfigId: id };
        saveToStorage(videoId, next);
        return next;
      });
    },
    [videoId],
  );

  const setUserInputContent = useCallback(
    (text: string) => {
      if (!videoId) return;
      setState((prev) => {
        const next = { ...prev, userInputContent: text };
        saveToStorage(videoId, next);
        return next;
      });
    },
    [videoId],
  );

  const setTargetAccountId = useCallback(
    (id: string | null) => {
      if (!videoId) return;
      setState((prev) => {
        const next = { ...prev, targetAccountId: id };
        saveToStorage(videoId, next);
        return next;
      });
    },
    [videoId],
  );

  const clearState = useCallback(() => {
    if (!videoId) return;
    setState({ ...INITIAL_STATE });
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(getStorageKey(videoId));
      } catch {
        // ignore
      }
    }
  }, [videoId]);

  return {
    state,
    setSelectedFragmentIds,
    setModelConfigId,
    setUserInputContent,
    setTargetAccountId,
    clearState,
  };
}
