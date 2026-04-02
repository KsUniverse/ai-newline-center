"use client";

import { MonitorPlay, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AccountEmptyStateProps {
  onAdd?: () => void;
}

export function AccountEmptyState({ onAdd }: AccountEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-4">
        <MonitorPlay className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-foreground/90">
        还没有添加账号
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground/80 max-w-sm">
        添加你管理的抖音账号，方便统一查看数据和管理内容
      </p>
      {onAdd && (
        <Button onClick={onAdd} size="sm" className="mt-6 h-8 rounded-md text-sm px-3 shadow-sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          添加账号
        </Button>
      )}
    </div>
  );
}
