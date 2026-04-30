"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Link2Off, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { VideoRewriteLinkDTO } from "@/types/video-link";
import { ApiError, apiClient } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shared/common/confirm-dialog";
import { Button } from "@/components/ui/button";

interface VideoRewriteLinkSectionProps {
  videoId: string;
}

export function VideoRewriteLinkSection({ videoId }: VideoRewriteLinkSectionProps) {
  const [link, setLink] = useState<VideoRewriteLinkDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const fetchLink = useCallback(async () => {
    try {
      const data = await apiClient.get<VideoRewriteLinkDTO | null>(
        `/videos/${videoId}/rewrite-link`,
      );
      setLink(data);
    } catch (err) {
      if (err instanceof ApiError && err.code === "FORBIDDEN") {
        setHidden(true);
      } else if (!(err instanceof ApiError && err.code === "NOT_FOUND")) {
        toast.error(err instanceof ApiError ? err.message : "加载关联文案失败");
      }
      setLink(null);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchLink();
  }, [fetchLink]);

  async function handleUnlink() {
    setUnlinking(true);
    try {
      await apiClient.del<void>(`/videos/${videoId}/rewrite-link`);
      setLink(null);
      setConfirmUnlinkOpen(false);
      toast.success("已解除关联");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "解除关联失败，请重试");
    } finally {
      setUnlinking(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-border/55 bg-background/70 p-4">
        <p className="mb-3 text-2xs font-medium uppercase tracking-[0.18em] text-primary/85">
          关联文案
        </p>
        <div className="flex h-12 items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>加载中…</span>
        </div>
      </section>
    );
  }

  if (hidden) return null;

  return (
    <section className="rounded-xl border border-border/55 bg-background/70 p-4">
      <p className="mb-3 text-2xs font-medium uppercase tracking-[0.18em] text-primary/85">
        关联文案
      </p>
      {link ? (
        <LinkedState link={link} onUnlink={() => setConfirmUnlinkOpen(true)} />
      ) : (
        <UnlinkedState />
      )}

      <ConfirmDialog
        open={confirmUnlinkOpen}
        onOpenChange={setConfirmUnlinkOpen}
        title="解除关联"
        description="确定要解除这条视频与文案的关联吗？解除后可重新关联。"
        confirmLabel="解除关联"
        onConfirm={handleUnlink}
        destructive
        loading={unlinking}
      />
    </section>
  );
}

function UnlinkedState() {
  return (
    <div className="rounded-lg border border-dashed border-border/45 bg-background px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
        <Link2 className="h-4 w-4 shrink-0" />
        <span>尚未关联仿写文案，请前往仿写版本区域进行绑定</span>
      </div>
    </div>
  );
}

function LinkedState({
  link,
  onUnlink,
}: {
  link: VideoRewriteLinkDTO;
  onUnlink: () => void;
}) {
  const modeLabel = link.rewriteMode === "WORKSPACE" ? "工作台仿写" : "直接创作";
  const contextLabel = link.rewriteTopic ?? link.targetAccountNickname ?? "—";
  const preview = link.finalContent ? link.finalContent.slice(0, 120) : null;

  return (
    <div className="space-y-2 rounded-lg border border-border/45 bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded border border-primary/14 bg-primary/8 px-1.5 py-0.5 text-2xs font-medium text-primary">
              {modeLabel}
            </span>
            {link.targetAccountNickname ? (
              <span className="text-2xs text-muted-foreground">
                → {link.targetAccountNickname}
              </span>
            ) : null}
          </div>
          <p className="text-sm font-medium text-foreground/90">{contextLabel}</p>
          {preview ? (
            <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground/75">
              {preview}
            </p>
          ) : null}
          <p className="text-2xs text-muted-foreground/55">
            关联于 {formatDateTime(link.linkedAt)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onUnlink}
          title="解除关联"
        >
          <Link2Off className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
