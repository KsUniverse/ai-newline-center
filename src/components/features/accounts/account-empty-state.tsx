"use client";

import { MonitorPlay, Plus } from "lucide-react";

import { TaskEmptyState } from "@/components/shared/common/task-empty-state";
import { Button } from "@/components/ui/button";

import {
  ACCOUNTS_ADD_ACTION_LABEL,
  getAccountsEmptyStateDescription,
  getAccountsEmptyStateTitle,
} from "./accounts-copy";

interface AccountEmptyStateProps {
  onAdd?: () => void;
}

export function AccountEmptyState({ onAdd }: AccountEmptyStateProps) {
  return (
    <TaskEmptyState
      icon={MonitorPlay}
      eyebrow="Source Intake"
      title={getAccountsEmptyStateTitle()}
      description={getAccountsEmptyStateDescription()}
      hint="先接入内容账号，再继续处理登录态和内容样本。"
      action={
        onAdd ? (
          <Button onClick={onAdd} size="sm" className="h-8 rounded-md px-3 text-sm">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {ACCOUNTS_ADD_ACTION_LABEL}
          </Button>
        ) : null
      }
    />
  );
}
