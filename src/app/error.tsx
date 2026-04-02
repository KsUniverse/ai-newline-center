"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-xl font-semibold">出现了一些错误</h1>
      <p className="text-sm text-muted-foreground">请尝试刷新页面或联系管理员</p>
      <Button onClick={reset} variant="outline" size="sm">
        重试
      </Button>
    </div>
  );
}
