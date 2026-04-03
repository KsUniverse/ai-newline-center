"use client";

import { Target, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

interface BenchmarkEmptyStateProps {
  archived?: boolean;
  onAdd?: () => void;
}

export function BenchmarkEmptyState({ archived = false, onAdd }: BenchmarkEmptyStateProps) {
  if (archived) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-4">
          <Target className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground/90">
          暂无已归档账号
        </h3>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-4">
        <Target className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-foreground/90">
        还没有对标账号
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground/80 max-w-sm">
        可手动添加或通过抖音收藏自动同步
      </p>
      {onAdd && (
        <Button onClick={onAdd} size="sm" className="mt-6 h-8 rounded-md text-sm px-3 shadow-sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          添加对标账号
        </Button>
      )}
    </div>
  );
}
