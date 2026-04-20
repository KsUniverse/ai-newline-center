"use client";

import { Plus } from "lucide-react";

import type { DouyinAccountDTO } from "@/types/douyin-account";
import { AccountRowCard } from "./account-row-card";

interface AccountRowProps {
  accounts: DouyinAccountDTO[];
  showAddButton?: boolean;
  onAddClick?: () => void;
}

export function AccountRow({ accounts, showAddButton, onAddClick }: AccountRowProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {accounts.map((account) => (
        <AccountRowCard key={account.id} account={account} />
      ))}
      {showAddButton && onAddClick && (
        <button
          type="button"
          onClick={onAddClick}
          className="flex min-w-50 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border/55 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          添加账号
        </button>
      )}
    </div>
  );
}
