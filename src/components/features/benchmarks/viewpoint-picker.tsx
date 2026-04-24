"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import type { CursorPaginatedData } from "@/types/api";
import type { FragmentDTO } from "@/types/fragment";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface ViewpointPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[], fragments: FragmentDTO[]) => void;
}

export const ViewpointPicker = memo(function ViewpointPicker({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
}: ViewpointPickerProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<FragmentDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedIds);
  const [allSelectedFragmentsMap, setAllSelectedFragmentsMap] = useState<Map<string, FragmentDTO>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when dialog opens
  useEffect(() => {
    if (open) {
      setLocalSelectedIds(selectedIds);
      setQuery("");
      setDebouncedQuery("");
      // Reset map, preserving entries for IDs still in selectedIds
      setAllSelectedFragmentsMap((prev) => {
        const next = new Map<string, FragmentDTO>();
        for (const id of selectedIds) {
          const existing = prev.get(id);
          if (existing) next.set(id, existing);
        }
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounce query
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Merge newly visible selected items into the persistent map
  useEffect(() => {
    if (items.length === 0) return;
    setAllSelectedFragmentsMap((prev) => {
      const next = new Map(prev);
      for (const item of items) {
        if (localSelectedIds.includes(item.id)) {
          next.set(item.id, item);
        }
      }
      return next;
    });
  }, [items, localSelectedIds]);

  // Load viewpoints
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ limit: "50", scope: "today" });
    if (debouncedQuery) {
      params.set("q", debouncedQuery);
    }

    void apiClient
      .get<CursorPaginatedData<FragmentDTO>>(`/viewpoints?${params.toString()}`)
      .then((result) => {
        if (!cancelled) {
          setItems(result.items);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "观点列表加载失败");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery]);

  const handleToggle = useCallback((id: string) => {
    setLocalSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleConfirm = useCallback(() => {
    const selectedFragments = localSelectedIds
      .map((id) => allSelectedFragmentsMap.get(id))
      .filter((f): f is FragmentDTO => f !== undefined);
    onConfirm(localSelectedIds, selectedFragments);
    onOpenChange(false);
  }, [allSelectedFragmentsMap, localSelectedIds, onConfirm, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden rounded-xl border-border/55 bg-card/95 p-0">
        <div className="flex flex-col">
          <DialogHeader className="border-b border-border/35 px-5 py-4 text-left">
            <DialogTitle className="text-base font-semibold tracking-tight text-foreground/95">
              选择今日观点
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground/80">
              选择今日创建的碎片观点作为仿写素材
            </DialogDescription>
          </DialogHeader>

          <div className="border-b border-border/35 px-5 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索观点内容..."
                className="h-9 rounded-xl border-border/55 bg-background/80 pl-9 text-sm"
              />
            </div>
          </div>

          <div className="flex min-h-50 max-h-90 flex-col gap-2 overflow-y-auto px-5 py-3">
            {loading ? (
              <div className="flex flex-1 items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground/70">
                {debouncedQuery ? "未找到匹配观点" : "今日暂无观点"}
              </div>
            ) : (
              items.map((item) => {
                const checked = localSelectedIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/55 bg-background/60 px-4 py-3 transition-colors hover:bg-background/90"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => handleToggle(item.id)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-6 text-foreground/90">
                        {item.content.length > 80
                          ? `${item.content.slice(0, 80)}...`
                          : item.content}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        {item.createdByUser.name}
                      </p>
                    </div>
                  </label>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border/35 px-5 py-4">
            <span className="text-sm text-muted-foreground/80">
              已选{" "}
              <Badge
                variant="secondary"
                className="rounded-md border border-border/45 bg-background/80 px-2 py-0.5 text-xs"
              >
                {localSelectedIds.length}
              </Badge>{" "}
              条
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg px-4 text-sm"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-lg px-4 text-sm"
                onClick={handleConfirm}
              >
                确认
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
