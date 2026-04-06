"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import type { DouyinVideoDTO } from "@/types/douyin-account";
import type { AiWorkspaceDTO, SaveAnnotationInput, SaveTranscriptInput } from "@/types/ai-workspace";
import { ApiError, apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  getAiWorkspaceColumnOrder,
  getAiWorkspaceModeCopy,
  type AiWorkspaceMode,
} from "./ai-workspace-layout";
import {
  buildInitialTranscript,
  createSeedAnnotations,
  splitTranscriptIntoSegments,
  type DecompositionAnnotation,
  type SelectedTextRange,
  type TranscriptSegment,
} from "./ai-workspace-model";
import { AiWorkspaceVideoColumn } from "./ai-workspace-video-column";
import { AiWorkspaceTranscriptColumn } from "./ai-workspace-transcript-column";
import { AiWorkspaceDecompositionColumn } from "./ai-workspace-decomposition-column";
import { AiWorkspaceRewriteColumn } from "./ai-workspace-rewrite-column";

interface BenchmarkVideoDetailPanelProps {
  video: DouyinVideoDTO | null;
  onClose: () => void;
}

function WorkspacePreview({
  video,
  open,
  onOpenChange,
}: {
  video: DouyinVideoDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl overflow-hidden rounded-[28px] border-border/60 bg-card/95 p-0">
        <div className="flex flex-col gap-4 p-5">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground/95">
              {video.title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground/80">
              点击缩略图进入的播放层，便于在理解态与仿写态之间随时回看。
            </DialogDescription>
          </DialogHeader>
          {video.videoUrl ? (
            <video
              controls
              autoPlay
              src={video.videoUrl}
              className="aspect-video w-full rounded-3xl border border-border/60 bg-black"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-3xl border border-border/60 bg-muted text-muted-foreground">
              当前视频没有可播放地址
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function mapSegments(workspace: AiWorkspaceDTO, video: DouyinVideoDTO): TranscriptSegment[] {
  if (workspace.segments.length > 0) {
    return workspace.segments.map((segment) => ({
      id: segment.id,
      label: `语义段 ${segment.sortOrder + 1}`,
      text: segment.text,
      startOffset: segment.startOffset,
      endOffset: segment.endOffset,
      summary: segment.summary ?? "待整理",
      purpose: segment.purpose ?? "待确认",
    }));
  }

  const fallbackText =
    workspace.transcript?.currentText ??
    workspace.transcript?.originalText ??
    buildInitialTranscript(video);
  return splitTranscriptIntoSegments(fallbackText);
}

function mapAnnotations(
  workspace: AiWorkspaceDTO,
  fallbackSegments: TranscriptSegment[],
): DecompositionAnnotation[] {
  if (workspace.annotations.length > 0) {
    return workspace.annotations.map((annotation) => ({
      id: annotation.id,
      segmentId: annotation.segmentId ?? fallbackSegments[0]?.id ?? "",
      startOffset: annotation.startOffset,
      endOffset: annotation.endOffset,
      quotedText: annotation.quotedText,
      function: annotation.function ?? "",
      argumentRole: annotation.argumentRole ?? "",
      technique: annotation.technique ?? "",
      purpose: annotation.purpose ?? "",
      effectiveness: annotation.effectiveness ?? "",
      note: annotation.note ?? "",
    }));
  }

  return [];
}

export function AiWorkspacePanel({ video, onClose }: BenchmarkVideoDetailPanelProps) {
  const [workspace, setWorkspace] = useState<AiWorkspaceDTO | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [mode, setMode] = useState<AiWorkspaceMode>("understanding");
  const [transcriptText, setTranscriptText] = useState("");
  const [locked, setLocked] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [selectedRange, setSelectedRange] = useState<SelectedTextRange | null>(null);
  const [isManualSelection, setIsManualSelection] = useState(false);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<DecompositionAnnotation[]>([]);
  const [draft, setDraft] = useState("");
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function applyWorkspace(
    next: AiWorkspaceDTO,
    sourceVideo: DouyinVideoDTO,
    options?: { preserveMode?: boolean; forceMode?: AiWorkspaceMode },
  ) {
    const nextTranscript =
      next.transcript?.currentText ??
      next.transcript?.originalText ??
      buildInitialTranscript(sourceVideo);
    const nextSegments = mapSegments(next, sourceVideo);
    const nextAnnotations = mapAnnotations(next, nextSegments);

    setWorkspace(next);
    if (options?.forceMode) {
      setMode(options.forceMode);
    } else if (!options?.preserveMode) {
      setMode("understanding");
    }
    setTranscriptText(nextTranscript);
    setConfirmed(next.transcript?.isConfirmed ?? false);
    setLocked(Boolean(next.transcript?.isConfirmed) || next.annotations.length > 0);
    setSegments(nextSegments);
    setSelectedRange(null);
    setIsManualSelection(false);
    setActiveAnnotationId(nextAnnotations[0]?.id ?? null);
    setAnnotations(nextAnnotations);
    setDraft(next.rewriteDraft?.currentDraft ?? "");
    setDraftDirty(false);
  }

  useEffect(() => {
    if (!video) return;
    const currentVideo = video;

    let cancelled = false;

    async function loadWorkspace() {
      setLoadingWorkspace(true);
      try {
        const next = await apiClient.get<AiWorkspaceDTO>(`/ai-workspaces?videoId=${currentVideo.id}`);
        if (!cancelled) {
          applyWorkspace(next, currentVideo, { forceMode: "understanding" });
        }
      } catch (error) {
        if (!cancelled) {
          const initialTranscript = buildInitialTranscript(currentVideo);
          const initialSegments = splitTranscriptIntoSegments(initialTranscript);
          const seedAnnotations = createSeedAnnotations(initialSegments);

          setWorkspace(null);
          setMode("understanding");
          setTranscriptText(initialTranscript);
          setLocked(false);
          setConfirmed(false);
          setSegments(initialSegments);
          setSelectedRange(null);
          setIsManualSelection(false);
          setActiveAnnotationId(seedAnnotations[0]?.id ?? null);
          setAnnotations(seedAnnotations);
          setDraft("");
          toast.error(error instanceof ApiError ? error.message : "AI 工作台加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoadingWorkspace(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [video]);

  useEffect(() => {
    if (!selectedRange) {
      return;
    }

    if (
      selectedRange.segmentId &&
      segments.some((segment) => segment.id === selectedRange.segmentId)
    ) {
      return;
    }

    setSelectedRange(null);
  }, [segments, selectedRange]);

  useEffect(() => {
    if (!workspace?.id || mode !== "rewrite" || !draftDirty) {
      return;
    }

    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }

    draftSaveTimerRef.current = setTimeout(() => {
      void apiClient
        .patch<AiWorkspaceDTO>(`/ai-workspaces/${workspace.id}/rewrite-draft`, {
          currentDraft: draft,
        })
        .then((next) => {
          if (video) {
            applyWorkspace(next, video, { preserveMode: true });
          }
        })
        .catch((error) => {
          toast.error(error instanceof ApiError ? error.message : "仿写草稿保存失败");
        });
    }, 600);

    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [draft, draftDirty, mode, workspace?.id, video]);

  if (!video) return null;
  const currentVideo = video;
  const columnOrder = getAiWorkspaceColumnOrder(mode);
  const modeCopy = getAiWorkspaceModeCopy(mode);

  function buildTranscriptPayload(): SaveTranscriptInput {
    return {
      currentText: transcriptText,
      segments: segments.map((segment, index) => ({
        sortOrder: index,
        text: segment.text,
        summary: segment.summary,
        purpose: segment.purpose,
        startOffset: segment.startOffset,
        endOffset: segment.endOffset,
      })),
    };
  }

  function handleGenerateTranscript() {
    setLoadingWorkspace(true);
    void apiClient
      .post<AiWorkspaceDTO>("/ai-workspaces/transcribe", {
        videoId: currentVideo.id,
      })
      .then((next) => applyWorkspace(next, currentVideo, { preserveMode: true }))
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : "发起转录失败");
      })
      .finally(() => {
        setLoadingWorkspace(false);
      });
  }

  function handleConfirmTranscript() {
    if (!workspace?.id) return;

    void apiClient
      .patch<AiWorkspaceDTO>(`/ai-workspaces/${workspace.id}/transcript`, buildTranscriptPayload())
      .then(() => apiClient.post<AiWorkspaceDTO>(`/ai-workspaces/${workspace.id}/transcript/confirm`, {}))
      .then((next) => applyWorkspace(next, currentVideo, { preserveMode: true }))
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : "确认转录稿失败");
      });
  }

  function handleEnterRewrite() {
    if (mode === "rewrite") {
      setMode("understanding");
      return;
    }

    const continueToRewrite = (workspaceId: string) =>
      apiClient.patch<AiWorkspaceDTO>(`/ai-workspaces/${workspaceId}/rewrite-draft`, {
        currentDraft: draft,
      });

    if (!workspace?.id) {
      toast.error("请先完成 AI 转录");
      return;
    }

    const request = confirmed
      ? continueToRewrite(workspace.id)
      : apiClient
          .patch<AiWorkspaceDTO>(`/ai-workspaces/${workspace.id}/transcript`, buildTranscriptPayload())
          .then(() => apiClient.post<AiWorkspaceDTO>(`/ai-workspaces/${workspace.id}/transcript/confirm`, {}))
          .then(() => continueToRewrite(workspace.id));

    void request
      .then((next) => {
        setMode("rewrite");
        applyWorkspace(next, currentVideo, { preserveMode: true });
      })
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : "进入仿写态失败");
      });
  }

  function handleUnlockTranscript() {
    setUnlockDialogOpen(false);
    if (!workspace?.id) return;

    void apiClient
      .post<AiWorkspaceDTO>(`/ai-workspaces/${workspace.id}/transcript/unlock`, {})
      .then((next) => applyWorkspace(next, currentVideo, { forceMode: "understanding" }))
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : "解锁编辑失败");
      });
  }

  function toggleAnnotationFocus(annotationId: string) {
    setActiveAnnotationId((current) => {
      if (current === annotationId) {
        setSelectedRange(null);
        setIsManualSelection(false);
        return null;
      }

      const matchedAnnotation = annotations.find((item) => item.id === annotationId);
      if (matchedAnnotation) {
        setSelectedRange({
          segmentId: matchedAnnotation.segmentId || null,
          startOffset: matchedAnnotation.startOffset,
          endOffset: matchedAnnotation.endOffset,
          quotedText: matchedAnnotation.quotedText,
        });
        setIsManualSelection(false);
      }

      return annotationId;
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="h-[calc(100vh-1rem)] max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-[1600px] overflow-hidden rounded-[28px] border-border/60 bg-card/95 p-0 shadow-2xl shadow-black/20">
        <div className="flex h-full flex-col overflow-hidden">
          <DialogHeader className="border-b border-border/60 px-5 py-4 text-left sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
                  Unified AI Workspace
                </p>
                <DialogTitle className="text-xl font-semibold tracking-tight text-foreground/95">
                  {currentVideo.title}
                </DialogTitle>
                <DialogDescription className="max-w-3xl text-sm leading-6 text-muted-foreground/80">
                  统一 AI 工作台，围绕原文、拆解与仿写持续对照。
                </DialogDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-md px-3 text-sm"
                  disabled={!transcriptText.trim()}
                  onClick={handleEnterRewrite}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {modeCopy.switchLabel}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col lg:flex-row">
              {columnOrder.map((columnId) => {
                if (columnId === "video") {
                  return (
                    <div
                      key="video"
                      className="animate-workspace-in-left min-h-0 border-b border-border/60 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:basis-[24%] lg:min-w-0 lg:self-stretch lg:border-b-0 lg:border-r"
                    >
                      <AiWorkspaceVideoColumn
                        video={currentVideo}
                        onPreview={() => setPreviewOpen(true)}
                      />
                    </div>
                  );
                }

                if (columnId === "transcript") {
                  return (
                    <div
                      key="transcript"
                      className={`min-h-0 border-b border-border/60 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:basis-[38%] lg:min-w-0 lg:self-stretch lg:border-b-0 lg:border-r ${
                        mode === "rewrite"
                          ? "scale-[1.01] opacity-100"
                          : "scale-100 opacity-100"
                      }`}
                    >
                      <AiWorkspaceTranscriptColumn
                        mode={mode}
                        transcriptText={transcriptText}
                        transcribing={loadingWorkspace || workspace?.status === "TRANSCRIBING"}
                        canGenerate={Boolean(currentVideo.shareUrl)}
                        locked={locked}
                        segments={segments}
                        annotations={annotations}
                        selectedRange={selectedRange}
                        activeAnnotationId={activeAnnotationId}
                        compactVideo={
                          <AiWorkspaceVideoColumn
                            video={currentVideo}
                            compact
                            onPreview={() => setPreviewOpen(true)}
                          />
                        }
                        onGenerate={handleGenerateTranscript}
                        onTextRangeSelect={(range) => {
                          setSelectedRange(range);
                          setIsManualSelection(true);
                          const overlappedAnnotations = annotations.filter(
                            (annotation) =>
                              range.startOffset < annotation.endOffset &&
                              range.endOffset > annotation.startOffset,
                          );
                          if (overlappedAnnotations.length === 1) {
                            setActiveAnnotationId(overlappedAnnotations[0]?.id ?? null);
                          } else {
                            setActiveAnnotationId(null);
                          }
                        }}
                        onAnnotationSelect={toggleAnnotationFocus}
                        onTranscriptTextChange={(next) => {
                          setTranscriptText(next);
                          if (!locked) {
                            setSegments(splitTranscriptIntoSegments(next));
                          }
                        }}
                        onToggleLock={() => {
                          if (locked) {
                            setUnlockDialogOpen(true);
                            return;
                          }
                          handleConfirmTranscript();
                        }}
                      />
                    </div>
                  );
                }

                if (columnId === "decomposition") {
                  return (
                    <div
                      key="decomposition"
                      className={`min-h-0 border-b border-border/60 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:min-w-0 lg:self-stretch lg:border-b-0 ${
                        mode === "rewrite" ? "lg:basis-[28%]" : "lg:basis-[38%]"
                      } ${
                        mode === "rewrite" ? "animate-workspace-in-left lg:border-r" : "opacity-100"
                      }`}
                    >
                      <AiWorkspaceDecompositionColumn
                        mode={mode}
                        annotations={annotations}
                        selectedRange={selectedRange}
                        isManualSelection={isManualSelection}
                        activeAnnotationId={activeAnnotationId}
                        onClearSelection={() => {
                          setSelectedRange(null);
                          setIsManualSelection(false);
                          setActiveAnnotationId(null);
                        }}
                        onAnnotationSelect={toggleAnnotationFocus}
                        onCreateAnnotation={(annotation) => {
                          if (!workspace?.id || !selectedRange) {
                            toast.error("请先在主文档中选择文本范围，再保存拆解");
                            return;
                          }

                          const payload: SaveAnnotationInput = {
                            segmentId: selectedRange.segmentId,
                            startOffset: selectedRange.startOffset,
                            endOffset: selectedRange.endOffset,
                            quotedText: selectedRange.quotedText,
                            function: annotation.function,
                            argumentRole: annotation.argumentRole,
                            technique: annotation.technique,
                            purpose: annotation.purpose,
                            effectiveness: annotation.effectiveness,
                            note: annotation.note,
                          };

                          void apiClient
                            .post<AiWorkspaceDTO>(`/ai-workspaces/${workspace.id}/annotations`, payload)
                            .then((next) => applyWorkspace(next, currentVideo, { preserveMode: true }))
                            .catch((error) => {
                              toast.error(
                                error instanceof ApiError ? error.message : "保存拆解失败",
                              );
                            });
                        }}
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key="rewrite"
                    className="animate-workspace-in-right min-h-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:basis-[34%] lg:min-w-0 lg:self-stretch"
                  >
                    <AiWorkspaceRewriteColumn
                      transcriptText={transcriptText}
                      annotations={annotations}
                      activeAnnotationId={activeAnnotationId}
                      draft={draft}
                      onDraftChange={(next) => {
                        setDraft(next);
                        setDraftDirty(true);
                      }}
                      onAnnotationSelect={toggleAnnotationFocus}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <AlertDialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>解锁编辑会清空已有拆解和仿写草稿</AlertDialogTitle>
              <AlertDialogDescription>
                继续后，当前转录内容会恢复可编辑状态，所有拆解结果和仿写内容都会被清空，避免旧结构继续引用错误文本。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleUnlockTranscript}>继续解锁</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <WorkspacePreview
          video={currentVideo}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
