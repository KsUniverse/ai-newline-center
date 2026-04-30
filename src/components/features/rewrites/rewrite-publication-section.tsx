"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Link2Off, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type {
  RewritePublicationCandidateDTO,
  RewritePublicationDTO,
} from "@/types/rewrite-publication";
import { ApiError, apiClient } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shared/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { PublicationVideoPickerDialog } from "./publication-video-picker-dialog";

interface RewritePublicationSectionProps {
  rewriteVersionId: string;
  canBind: boolean;
}

export function RewritePublicationSection({
  rewriteVersionId,
  canBind,
}: RewritePublicationSectionProps) {
  const [publication, setPublication] = useState<RewritePublicationDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);
  const [candidates, setCandidates] = useState<RewritePublicationCandidateDTO[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const fetchPublication = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<RewritePublicationDTO | null>(
        `/rewrite-versions/${rewriteVersionId}/publication`,
      );
      setPublication(data);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "加载发布绑定失败");
      setPublication(null);
    } finally {
      setLoading(false);
    }
  }, [rewriteVersionId]);

  useEffect(() => {
    setSelectedId(null);
    void fetchPublication();
  }, [fetchPublication]);

  async function openPicker() {
    setPickerOpen(true);
    setCandidatesLoading(true);
    setSelectedId(null);
    try {
      const data = await apiClient.get<RewritePublicationCandidateDTO[]>(
        `/rewrite-versions/${rewriteVersionId}/publication/candidates`,
      );
      setCandidates(data);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "加载候选视频失败");
      setCandidates([]);
    } finally {
      setCandidatesLoading(false);
    }
  }

  async function handleConfirmLink() {
    if (!selectedId) {
      return;
    }

    setLinking(true);
    try {
      const data = await apiClient.post<RewritePublicationDTO>(
        `/rewrite-versions/${rewriteVersionId}/publication`,
        { publishedVideoId: selectedId },
      );
      setPublication(data);
      setPickerOpen(false);
      toast.success("关联成功");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "关联失败，请重试");
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    setUnlinking(true);
    try {
      await apiClient.del(`/rewrite-versions/${rewriteVersionId}/publication`);
      setPublication(null);
      setConfirmUnlinkOpen(false);
      toast.success("已解除关联");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "解除关联失败，请重试");
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <section className="rounded-lg border border-border/35 bg-card/45 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/75">
          发布绑定
        </p>
        {canBind && !loading && !publication ? (
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={openPicker}>
            <Link2 className="mr-1.5 h-3 w-3" />
            关联已发布视频
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex h-12 items-center gap-2 text-xs text-muted-foreground/70">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          加载中...
        </div>
      ) : publication ? (
        <div className="rounded-lg border border-border/45 bg-background/80 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="line-clamp-2 text-sm font-medium text-foreground/90">
                {publication.publishedVideo.title}
              </p>
              <p className="text-2xs text-muted-foreground/70">
                关联于 {formatDateTime(publication.linkedAt)}
              </p>
              <p className="text-2xs text-muted-foreground/70">
                播放 {publication.publishedVideo.playCount.toLocaleString()} · 赞{" "}
                {publication.publishedVideo.likeCount.toLocaleString()} · 评{" "}
                {publication.publishedVideo.commentCount.toLocaleString()} · 转{" "}
                {publication.publishedVideo.shareCount.toLocaleString()}
              </p>
              {publication.learningSummary ? (
                <p className="text-2xs text-emerald-600">
                  已沉淀学习案例 · 表现分 {publication.learningSummary.performanceScore}
                </p>
              ) : (
                <p className="text-2xs text-muted-foreground/60">
                  已绑定，等待快照数据补齐学习案例
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmUnlinkOpen(true)}
              title="解除关联"
            >
              <Link2Off className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/45 bg-background/80 px-3 py-3 text-xs text-muted-foreground/75">
          {canBind ? "当前版本尚未绑定发布视频" : "完成生成并选择目标账号后，可在此绑定发布视频"}
        </div>
      )}

      <PublicationVideoPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        items={candidates}
        loading={candidatesLoading}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onConfirm={handleConfirmLink}
        confirming={linking}
      />

      <ConfirmDialog
        open={confirmUnlinkOpen}
        onOpenChange={setConfirmUnlinkOpen}
        title="解除关联"
        description="解除后，该版本不再参与后续学习案例生成。"
        confirmLabel="解除关联"
        onConfirm={handleUnlink}
        destructive
        loading={unlinking}
      />
    </section>
  );
}
