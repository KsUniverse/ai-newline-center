"use client";

import { Loader2, Video } from "lucide-react";

import type { RewritePublicationCandidateDTO } from "@/types/rewrite-publication";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PublicationVideoPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: RewritePublicationCandidateDTO[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  confirming: boolean;
}

export function PublicationVideoPickerDialog({
  open,
  onOpenChange,
  items,
  loading,
  selectedId,
  onSelect,
  onConfirm,
  confirming,
}: PublicationVideoPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">
            发布绑定
          </p>
          <DialogTitle>选择已发布视频</DialogTitle>
        </DialogHeader>

        <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/45 bg-background text-center">
              <Video className="h-5 w-5 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground/80">
                该账号暂无可关联视频，请先同步账号视频
              </p>
            </div>
          ) : (
            items.map((item) => {
              const selected = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => onSelect(item.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    item.disabled
                      ? "cursor-not-allowed border-border/30 bg-muted/20 opacity-60"
                      : selected
                        ? "border-primary/40 bg-primary/6 ring-1 ring-primary/30"
                        : "border-border/45 bg-background hover:border-border/70 hover:bg-card/80"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.coverUrl}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="line-clamp-2 text-sm font-medium text-foreground/90">
                        {item.title}
                      </p>
                      <p className="text-2xs text-muted-foreground/70">
                        {item.publishedAt ? formatDateTime(item.publishedAt) : "未记录发布时间"}
                      </p>
                      <p className="text-2xs text-muted-foreground/70">
                        播放 {item.playCount.toLocaleString()} · 赞 {item.likeCount.toLocaleString()}
                        · 评 {item.commentCount.toLocaleString()} · 转{" "}
                        {item.shareCount.toLocaleString()}
                      </p>
                      {item.disabledReason ? (
                        <p className="text-2xs text-destructive/80">{item.disabledReason}</p>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            取消
          </Button>
          <Button onClick={onConfirm} disabled={!selectedId || confirming}>
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
