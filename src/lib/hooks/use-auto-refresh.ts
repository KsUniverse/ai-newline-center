"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 每隔 intervalMs 毫秒自动调用 callback。
 * isRefreshing 在 callback 触发后约 800ms 内为 true，可用于驱动旋转动画。
 */
export function useAutoRefresh(intervalMs: number, callback: () => void) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  // 持有最新 callback 的 ref，避免 setInterval 捕获旧闭包
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  // 持有 setTimeout id，确保组件卸载时可清理
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    callbackRef.current();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsRefreshing(false), 800);
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, intervalMs);
    return () => {
      clearInterval(id);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [intervalMs, refresh]);

  return { isRefreshing };
}
