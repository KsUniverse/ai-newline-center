"use client";

import { Archive, Plus, ScanSearch } from "lucide-react";

import { TaskEmptyState } from "@/components/shared/common/task-empty-state";
import { Button } from "@/components/ui/button";

import {
  BENCHMARK_ADD_ACTION_LABEL,
  getBenchmarkEmptyStateDescription,
  getBenchmarkEmptyStateTitle,
} from "./benchmark-copy";

interface BenchmarkEmptyStateProps {
  archived?: boolean;
  onAdd?: () => void;
}

export function BenchmarkEmptyState({ archived = false, onAdd }: BenchmarkEmptyStateProps) {
  return (
    <TaskEmptyState
      icon={archived ? Archive : ScanSearch}
      eyebrow={archived ? "Archive Memory" : "Research Intake"}
      title={getBenchmarkEmptyStateTitle(archived)}
      description={getBenchmarkEmptyStateDescription(archived)}
      hint={
        archived
          ? "归档对象仍可继续回看资料、作品样本和研究记录。"
          : "先纳入研究对象，再继续浏览档案、样本和归档操作。"
      }
      tone={archived ? "muted" : "default"}
      action={
        !archived && onAdd ? (
          <Button onClick={onAdd} size="sm" className="h-8 rounded-md px-3 text-sm shadow-sm">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {BENCHMARK_ADD_ACTION_LABEL}
          </Button>
        ) : null
      }
    />
  );
}
