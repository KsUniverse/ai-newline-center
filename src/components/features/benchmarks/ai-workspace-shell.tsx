"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";

import type { DouyinVideoDTO } from "@/types/douyin-account";
import { cn, proxyImageUrl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BRAND_DIVIDER_CLASS_NAME,
  BRAND_WORKSPACE_PANEL_CLASS_NAME,
} from "@/components/shared/common/brand";
import {
  WORKSPACE_BACKDROP_LAYER_CLASS,
  WORKSPACE_GHOST_LAYER_CLASS,
  WORKSPACE_SHELL_LAYER_CLASS,
} from "@/components/ui/layering";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
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

import type { AiWorkspaceStage } from "./ai-workspace-controller";
import { useAiWorkspaceController } from "./ai-workspace-controller";
import {
  parseBorderRadiusPx,
  type AiWorkspaceTransitionOrigin,
} from "./ai-workspace-transition";
import { AiWorkspaceVideoPane } from "./ai-workspace-video-pane";
import { AiWorkspaceTranscriptCanvas } from "./ai-workspace-transcript-canvas";
import { AiWorkspaceDecompositionPanel } from "./ai-workspace-decomposition-panel";
import { AiWorkspaceRewriteStageV2 } from "./ai-workspace-rewrite-stage-v2";
import { getWorkspaceShellColumns } from "./ai-workspace-rewrite-layout";

type TransitionPhase =
  | "idle"
  | "opening-card"
  | "opening-second"
  | "opening-third"
  | "closing-third"
  | "closing-second"
  | "closing-card";

interface WorkspaceShellMotionState {
  frameOpacity: number;
  shellChromeOpacity: number;
  backdropOpacity: number;
  secondVisible: boolean;
  thirdVisible: boolean;
  secondTransform: string;
  thirdTransform: string;
}

interface AiWorkspaceShellProps {
  video: DouyinVideoDTO | null;
  onClose: () => void;
  originRect?: AiWorkspaceTransitionOrigin | null;
  onSourceReveal?: () => void;
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
      <DialogContent
        className={cn(
          "w-[calc(100vw-1rem)] max-w-4xl overflow-hidden p-0",
          BRAND_WORKSPACE_PANEL_CLASS_NAME,
        )}
      >
        <div className="flex flex-col gap-4 p-5">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground/95">
              {video.title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground/80">
              在工作台中随时回看原视频，避免分析和创作脱离素材本身。
            </DialogDescription>
          </DialogHeader>
          {video.videoUrl ? (
            <video
              controls
              autoPlay
              src={video.videoUrl}
              className="aspect-video w-full rounded-xl border border-border/55 bg-black"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-border/55 bg-muted text-muted-foreground">
              当前视频没有可播放地址
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getTargetRect(anchor: HTMLElement | null): AiWorkspaceTransitionOrigin | null {
  if (!anchor) {
    return null;
  }

  const rect = anchor.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    borderRadius: parseBorderRadiusPx(window.getComputedStyle(anchor).borderTopLeftRadius),
  };
}

function getWorkspaceShellMotionState(
  transitionPhase: TransitionPhase,
): WorkspaceShellMotionState {
  return {
    frameOpacity:
      transitionPhase === "opening-card"
        ? 0.08
        : transitionPhase === "closing-card"
          ? 0
          : 1,
    shellChromeOpacity:
      transitionPhase === "opening-card"
        ? 0.06
        : transitionPhase === "closing-card"
          ? 0.06
          : 1,
    backdropOpacity:
      transitionPhase === "opening-card"
        ? 0
        : transitionPhase === "opening-second"
          ? 0.28
          : transitionPhase === "opening-third"
            ? 0.78
            : transitionPhase === "closing-card"
              ? 0
              : transitionPhase === "closing-second"
                ? 0.28
                : transitionPhase === "closing-third"
                  ? 0.78
                  : 1,
    secondVisible:
      transitionPhase === "opening-second" ||
      transitionPhase === "opening-third" ||
      transitionPhase === "idle",
    thirdVisible:
      transitionPhase === "opening-third" || transitionPhase === "idle",
    secondTransform:
      transitionPhase === "opening-second" ||
      transitionPhase === "opening-third" ||
      transitionPhase === "idle"
        ? "translateX(0) scaleX(1)"
        : "translateX(-12px) scaleX(0.94)",
    thirdTransform:
      transitionPhase === "opening-third" || transitionPhase === "idle"
        ? "translateX(0) scaleX(1)"
        : "translateX(-18px) scaleX(0.9)",
  };
}

export function AiWorkspaceShell({
  video,
  onClose,
  originRect,
  onSourceReveal,
}: AiWorkspaceShellProps) {
  const controller = useAiWorkspaceController({ video });
  const videoAnchorRef = useRef<HTMLDivElement | null>(null);
  const requestCloseRef = useRef<() => void>(() => {});
  const timersRef = useRef<number[]>([]);
  const [mounted, setMounted] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>(
    originRect ? "opening-card" : "idle",
  );
  const [visualStage, setVisualStage] = useState<AiWorkspaceStage>("transcribe");
  const [ghostRect, setGhostRect] = useState<AiWorkspaceTransitionOrigin | null>(null);
  const [ghostVisible, setGhostVisible] = useState(false);
  const [ghostFading, setGhostFading] = useState(false);

  const columnOrder = useMemo(() => getWorkspaceShellColumns(visualStage), [visualStage]);
  const motionState = useMemo(
    () => getWorkspaceShellMotionState(transitionPhase),
    [transitionPhase],
  );

  const clearTransitionTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const scheduleTransition = useCallback((delay: number, callback: () => void) => {
    const timer = window.setTimeout(callback, delay);
    timersRef.current.push(timer);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!video) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [video]);

  useEffect(() => {
    if (!video) {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestCloseRef.current();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [video]);

  useEffect(() => {
    if (transitionPhase === "idle") {
      setVisualStage(controller.stage);
    }
  }, [controller.stage, transitionPhase]);

  useLayoutEffect(() => {
    if (!video) {
      return;
    }

    clearTransitionTimers();

    if (!originRect || !videoAnchorRef.current) {
      setTransitionPhase("idle");
      setGhostVisible(false);
      setGhostFading(false);
      setGhostRect(null);
      return;
    }

    const targetRect = getTargetRect(videoAnchorRef.current);
    if (!targetRect) {
      setTransitionPhase("idle");
      return;
    }

    setVisualStage("transcribe");
    setTransitionPhase("opening-card");
    setGhostVisible(true);
    setGhostFading(false);
    setGhostRect(originRect);

    requestAnimationFrame(() => {
      setGhostRect(targetRect);
    });

    scheduleTransition(300, () => {
      setTransitionPhase("opening-second");
    });
    scheduleTransition(470, () => {
      setTransitionPhase("opening-third");
    });
    scheduleTransition(520, () => {
      setGhostFading(true);
    });
    scheduleTransition(700, () => {
      setGhostVisible(false);
      setGhostFading(false);
      setGhostRect(null);
      setTransitionPhase("idle");
    });

    return () => {
      clearTransitionTimers();
    };
  }, [clearTransitionTimers, originRect, scheduleTransition, video]);

  useEffect(() => {
    return () => {
      clearTransitionTimers();
    };
  }, [clearTransitionTimers]);

  const handleRequestClose = useCallback(() => {
    if (!originRect) {
      onClose();
      return;
    }

    const currentTarget = getTargetRect(videoAnchorRef.current);
    if (!currentTarget) {
      onClose();
      return;
    }

    clearTransitionTimers();

    setVisualStage("transcribe");
    setTransitionPhase("closing-third");
    setGhostVisible(false);
    setGhostFading(false);
    setGhostRect(null);

    scheduleTransition(150, () => {
      setTransitionPhase("closing-second");
    });
    scheduleTransition(300, () => {
      setTransitionPhase("closing-card");
      onSourceReveal?.();
      setGhostVisible(true);
      setGhostRect(currentTarget);
      requestAnimationFrame(() => {
        setGhostRect(originRect);
      });
    });
    scheduleTransition(680, () => {
      onClose();
    });
  }, [clearTransitionTimers, onClose, onSourceReveal, originRect, scheduleTransition]);

  useEffect(() => {
    requestCloseRef.current = handleRequestClose;
  }, [handleRequestClose]);

  if (!video || !mounted) {
    return null;
  }

  const content = (
    <>
      {ghostVisible && ghostRect ? (
        <div
          className={`pointer-events-none fixed ${WORKSPACE_GHOST_LAYER_CLASS} overflow-hidden border border-border/55 bg-card/95 shadow-2xl shadow-black/25 transition-[top,left,width,height,border-radius,opacity] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)]`}
          style={{
            top: ghostRect.top,
            left: ghostRect.left,
            width: ghostRect.width,
            height: ghostRect.height,
            borderRadius: ghostRect.borderRadius,
            opacity: ghostFading ? 0 : 1,
          }}
        >
          {video.coverUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={proxyImageUrl(video.coverUrl)}
              alt={video.title}
              className="h-full w-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/18 to-transparent" />
        </div>
      ) : null}

      <div
        className={`fixed inset-0 ${WORKSPACE_BACKDROP_LAYER_CLASS} bg-black/65 backdrop-blur-sm transition-opacity duration-300`}
        style={{ opacity: motionState.backdropOpacity }}
        onClick={handleRequestClose}
      />

      <div className={`fixed inset-2 ${WORKSPACE_SHELL_LAYER_CLASS} flex items-center justify-center`}>
        <div
          className={cn(
            "relative flex h-full w-full max-w-400 flex-col overflow-hidden shadow-2xl shadow-black/20 transition-opacity duration-300",
            BRAND_WORKSPACE_PANEL_CLASS_NAME,
          )}
          style={{ opacity: motionState.frameOpacity }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_30%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.08),transparent_34%)]" />
          <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.08]" />

          <div
            className={cn(
              "relative border-b px-5 py-4 text-left transition-opacity duration-300 sm:px-6",
              BRAND_DIVIDER_CLASS_NAME,
            )}
            style={{ opacity: motionState.shellChromeOpacity }}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
                  Unified AI Workspace
                </p>
                <h2 className="text-xl font-semibold tracking-tight text-foreground/95">
                  {video.title}
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground/80">
                  三段式 AI 工作台。先完成转录，再进入拆解，最后进入不可回退的仿写阶段。
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="secondary" className="rounded-md border border-border/45 bg-background/80 px-2.5 py-1 text-2xs font-medium">
                    {visualStage === "rewrite" ? "仿写阶段" : visualStage === "decompose" ? "拆解阶段" : "转录阶段"}
                  </Badge>
                  <Badge variant="secondary" className="rounded-md border border-border/45 bg-background/80 px-2.5 py-1 text-2xs font-medium">
                    {visualStage === "rewrite" ? "仿写已锁定" : controller.locked ? "主文档已锁定" : "主文档可编辑"}
                  </Badge>
                  <Badge variant="secondary" className="rounded-md border border-border/45 bg-background/80 px-2.5 py-1 text-2xs font-medium">
                    {controller.annotations.length} 条拆解锚点
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {visualStage !== "rewrite" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-md px-3 text-sm"
                    disabled={!controller.transcriptText.trim()}
                    onClick={controller.handleEnterRewriteStage}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    进入仿写态
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="flex h-full min-h-0">
              {columnOrder.map((columnId, index) => {
                const secondColumn = index === 1;
                const thirdColumn = index === 2;
                const scale = secondColumn
                  ? motionState.secondVisible
                    ? 1
                    : 0
                  : thirdColumn
                    ? motionState.thirdVisible
                      ? 1
                      : 0
                    : 1;
                const widthClass =
                  visualStage === "rewrite"
                    ? "basis-full flex-1"
                    : index === 0
                      ? "basis-[24%]"
                      : "basis-[38%]";

                if (columnId === "video") {
                  return (
                    <div
                      key="video"
                      className={`min-w-0 ${widthClass} overflow-hidden border-r border-border/55`}
                    >
                      <AiWorkspaceVideoPane
                        ref={videoAnchorRef}
                        video={video}
                        matchCardRatio
                      />
                    </div>
                  );
                }

                if (columnId === "transcript") {
                  return (
                    <div
                      key="transcript"
                      className={`min-w-0 ${widthClass} overflow-hidden border-r border-border/55 transition-[transform,opacity] duration-280 ease-[cubic-bezier(0.22,1,0.36,1)]`}
                      style={{
                        transform: motionState.secondTransform,
                        transformOrigin: "left center",
                        opacity: scale,
                      }}
                    >
                      <AiWorkspaceTranscriptCanvas
                        stage={visualStage}
                        transcriptText={controller.transcriptText}
                        transcribing={
                          controller.loadingWorkspace ||
                          controller.workspace?.status === "TRANSCRIBING"
                        }
                        canGenerate={controller.canGenerate}
                        locked={controller.locked}
                        annotations={controller.annotations}
                        selectedRange={controller.selectedRange}
                        activeAnnotationId={controller.activeAnnotationId}
                        compactVideo={
                          <AiWorkspaceVideoPane
                            video={video}
                            compact
                          />
                        }
                        onGenerate={controller.handleGenerateTranscript}
                        onToggleLock={controller.handleToggleLock}
                        onTextRangeSelect={controller.handleSelectRange}
                        onAnnotationSelect={controller.handleToggleAnnotationFocus}
                        onTranscriptTextChange={controller.setTranscriptText}
                      />
                    </div>
                  );
                }

                if (columnId === "decomposition") {
                  return (
                    <div
                      key="decomposition"
                      className={`min-w-0 ${widthClass} overflow-hidden border-r border-border/55 transition-[transform,opacity] duration-280 ease-[cubic-bezier(0.22,1,0.36,1)]`}
                      style={{
                        transform:
                          index === 1
                            ? motionState.secondTransform
                            : motionState.thirdTransform,
                        transformOrigin: "left center",
                        opacity: scale,
                      }}
                    >
                      <AiWorkspaceDecompositionPanel
                        workspaceId={controller.workspace?.id ?? null}
                        focusState={controller.focusState}
                        annotations={controller.annotations}
                        selectedRange={controller.selectedRange}
                        activeAnnotationId={controller.activeAnnotationId}
                        onClearSelection={controller.handleClearSelection}
                        onAnnotationSelect={controller.handleToggleAnnotationFocus}
                        onCreateAnnotation={controller.handleCreateAnnotation}
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key="rewrite"
                    className={`min-w-0 ${widthClass} overflow-hidden transition-[transform,opacity] duration-280 ease-[cubic-bezier(0.22,1,0.36,1)]`}
                    style={{
                      transform: motionState.thirdTransform,
                      transformOrigin: "left center",
                      opacity: scale,
                    }}
                  >
                    <AiWorkspaceRewriteStageV2
                      transcriptText={controller.transcriptText}
                      annotations={controller.annotations}
                      activeAnnotationId={controller.activeAnnotationId}
                      onAnnotationSelect={controller.handleToggleAnnotationFocus}
                      videoId={video.id}
                      rewrite={controller.rewrite}
                      activeVersionId={controller.activeVersionId}
                      generatingRewrite={controller.generatingRewrite}
                      onGenerateRewrite={controller.onGenerateRewrite}
                      onSaveVersionEdit={controller.onSaveVersionEdit}
                      onSetActiveVersionId={controller.onSetActiveVersionId}
                      onSetFinalVersion={controller.onSetFinalVersion}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog
        open={controller.unlockDialogOpen}
        onOpenChange={controller.handleUnlockDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {controller.destructiveAction === "retranscribe"
                ? "重新 AI 转录会清空当前转录和拆解"
                : "解锁编辑会清空已有拆解和仿写草稿"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {controller.destructiveAction === "retranscribe"
                ? "继续后，当前员工工作台里的转录正文、分段和拆解结果都会被清空，并重新发起 AI 转录。"
                : "继续后，当前转录内容会恢复可编辑状态，所有拆解结果和仿写内容都会被清空，避免旧结构继续引用错误文本。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={controller.handleConfirmDestructiveAction}>
              {controller.destructiveAction === "retranscribe" ? "继续转录" : "继续解锁"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WorkspacePreview
        video={video}
        open={controller.previewOpen}
        onOpenChange={controller.setPreviewOpen}
      />
    </>
  );

  return createPortal(content, document.body);
}
