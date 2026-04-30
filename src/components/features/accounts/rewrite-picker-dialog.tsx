"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { RewritePickerItemDTO } from "@/types/video-link";
import { ApiError, apiClient } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RewritePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (item: RewritePickerItemDTO) => void;
  confirming: boolean;
}

export function RewritePickerDialog({
  open,
  onOpenChange,
  onConfirm,
  confirming,
}: RewritePickerDialogProps) {
  const [items, setItems] = useState<RewritePickerItemDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<RewritePickerItemDTO | null>(null);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiClient
      .get<RewritePickerItemDTO[]>("/rewrites/mine")
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.message : "加载仿写列表失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">
            关联文案
          </p>
          <DialogTitle>选择仿写任务</DialogTitle>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-center">
              <FileText className="h-6 w-6 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground/80">暂无有最终稿的仿写任务</p>
            </div>
          ) : (
            items.map((item) => (
              <RewritePickerItem
                key={item.id}
                item={item}
                selected={selected?.id === item.id}
                onSelect={() => setSelected(item)}
              />
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            取消
          </Button>
          <Button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected || confirming}
          >
            {confirming ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                关联中...
              </>
            ) : (
              "确认关联"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RewritePickerItem({
  item,
  selected,
  onSelect,
}: {
  item: RewritePickerItemDTO;
  selected: boolean;
  onSelect: () => void;
}) {
  const modeLabel = item.mode === "WORKSPACE" ? "工作台仿写" : "直接创作";
  const contextLabel =
    item.mode === "WORKSPACE" && item.benchmarkVideoTitle
      ? item.benchmarkVideoTitle
      : (item.topic ?? "—");
  const preview = item.finalContent ? item.finalContent.slice(0, 100) : "（无内容预览）";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-primary/40 bg-primary/6 ring-1 ring-primary/30"
          : "border-border/45 bg-background hover:border-border/70 hover:bg-card/80"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded border border-primary/14 bg-primary/8 px-1.5 py-0.5 text-2xs font-medium text-primary">
              {modeLabel}
            </span>
            {item.targetAccountNickname ? (
              <span className="text-2xs text-muted-foreground">
                → {item.targetAccountNickname}
              </span>
            ) : null}
          </div>
          <p className="truncate text-sm font-medium text-foreground/90">{contextLabel}</p>
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground/80">
            {preview}
          </p>
          <p className="text-2xs text-muted-foreground/60">{formatDateTime(item.createdAt)}</p>
        </div>
        {selected ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        ) : null}
      </div>
    </button>
  );
}
