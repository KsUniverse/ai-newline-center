"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useTypewriterText() {
  const [displayedText, setDisplayedText] = useState("");
  const displayedRef = useRef("");
  const targetRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleCallbackRef = useRef<(() => void) | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flushIdleCallback = useCallback(() => {
    const callback = idleCallbackRef.current;
    idleCallbackRef.current = null;
    callback?.();
  }, []);

  const tick = useCallback(() => {
    const remaining = targetRef.current.length - displayedRef.current.length;

    if (remaining <= 0) {
      clearTimer();
      flushIdleCallback();
      return;
    }

    const advance = Math.max(1, Math.min(remaining, 3));
    const next = targetRef.current.slice(0, displayedRef.current.length + advance);
    displayedRef.current = next;
    setDisplayedText(next);
    timerRef.current = setTimeout(tick, 16);
  }, [clearTimer, flushIdleCallback]);

  const ensureTicking = useCallback(() => {
    if (timerRef.current) {
      return;
    }

    if (displayedRef.current.length >= targetRef.current.length) {
      flushIdleCallback();
      return;
    }

    timerRef.current = setTimeout(tick, 16);
  }, [flushIdleCallback, tick]);

  const replaceTarget = useCallback(
    (next: string, onIdle?: () => void) => {
      targetRef.current = next;
      if (onIdle) {
        idleCallbackRef.current = onIdle;
      }
      ensureTicking();
    },
    [ensureTicking],
  );

  const appendTarget = useCallback(
    (delta: string, onIdle?: () => void) => {
      targetRef.current += delta;
      if (onIdle) {
        idleCallbackRef.current = onIdle;
      }
      ensureTicking();
    },
    [ensureTicking],
  );

  const reset = useCallback(
    (next: string = "") => {
      clearTimer();
      targetRef.current = next;
      displayedRef.current = next;
      idleCallbackRef.current = null;
      setDisplayedText(next);
    },
    [clearTimer],
  );

  const whenIdle = useCallback(
    (callback: () => void) => {
      if (displayedRef.current.length >= targetRef.current.length) {
        callback();
        return;
      }

      idleCallbackRef.current = callback;
    },
    [],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return useMemo(
    () => ({
      displayedText,
      replaceTarget,
      appendTarget,
      reset,
      whenIdle,
      getTargetText: () => targetRef.current,
    }),
    [appendTarget, displayedText, replaceTarget, reset, whenIdle],
  );
}
