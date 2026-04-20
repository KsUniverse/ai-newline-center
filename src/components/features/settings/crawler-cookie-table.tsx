"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { CrawlerCookieDTO } from "@/types/crawler-cookie";

interface CrawlerCookieTableProps {
  items: CrawlerCookieDTO[];
  selectedIds: Set<string>;
  onSelectChange: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CrawlerCookieTable({
  items,
  selectedIds,
  onSelectChange,
  onSelectAll,
  onDelete,
}: CrawlerCookieTableProps) {
  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;

  return (
    <div className="rounded-lg border border-border/55 bg-card/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/35 bg-background/50 px-4 py-3">
        <div className="flex h-4 w-4 shrink-0 items-center justify-center">
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={(checked) => onSelectAll(!!checked)}
            aria-label="全选"
          />
        </div>
        <div className="flex-1 text-2xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
          Cookie（脱敏）
        </div>
        <div className="w-44 shrink-0 text-2xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
          添加时间
        </div>
        <div className="w-20 shrink-0 text-right text-2xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
          操作
        </div>
      </div>

      {/* Rows */}
      {items.map((item, idx) => {
        const isSelected = selectedIds.has(item.id);
        return (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3.5 transition-colors",
              idx < items.length - 1 && "border-b border-border/40",
              isSelected ? "bg-primary/5" : "hover:bg-background/60",
            )}
          >
            <div className="flex h-4 w-4 shrink-0 items-center justify-center">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelectChange(item.id, !!checked)}
                aria-label={`选择 Cookie ${item.id}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <code className="block truncate rounded-lg bg-muted/50 px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
                {item.valueRedacted}
              </code>
            </div>
            <div className="w-44 shrink-0 text-sm text-muted-foreground">
              {formatDate(item.createdAt)}
            </div>
            <div className="w-20 shrink-0 flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(item.id)}
                aria-label="删除"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
