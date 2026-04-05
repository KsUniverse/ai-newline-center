"use client";

import { useEffect, useRef } from "react";

export function useAutoRefresh(intervalMs: number, callback: () => void) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const id = setInterval(() => {
      callbackRef.current();
    }, intervalMs);

    return () => {
      clearInterval(id);
    };
  }, [intervalMs]);

  return { isRefreshing: false };
}
