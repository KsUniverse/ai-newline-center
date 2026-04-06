"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { DouyinVideoDTO } from "@/types/douyin-account";
import type { AiWorkspaceDTO, SaveAnnotationInput, SaveTranscriptInput } from "@/types/ai-workspace";
import { ApiError, apiClient } from "@/lib/api-client";

import {
  buildInitialTranscript,
  mapWorkspaceAnnotations,
  splitTranscriptIntoSegments,
  type SelectedTextRange,
} from "./ai-workspace-view-model";

export type AiWorkspaceStage = "analysis" | "rewrite";
export type AiWorkspaceFocusState = "browsing" | "selecting" | "focused";

interface UseAiWorkspaceControllerOptions {
  video: DouyinVideoDTO | null;
}

interface ApplyWorkspaceOptions {
  preserveStage?: boolean;
  nextStage?: AiWorkspaceStage;
  nextSelection?: SelectedTextRange | null;
  nextActiveAnnotationId?: string | null;
}

function buildTranscriptPayload(text: string): SaveTranscriptInput {
  const segments = splitTranscriptIntoSegments(text);

  return {
    currentText: text,
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

function findLatestAnnotationId(
  workspace: AiWorkspaceDTO,
  range: SelectedTextRange,
  note: string,
): string | null {
  const matched = workspace.annotations
    .filter(
      (annotation) =>
        annotation.startOffset === range.startOffset &&
        annotation.endOffset === range.endOffset &&
        (annotation.note ?? annotation.function ?? "").trim() === note.trim(),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return matched[0]?.id ?? workspace.annotations.at(-1)?.id ?? null;
}

function isWorkspaceMissing(error: unknown): boolean {
  return error instanceof ApiError && error.code === "NOT_FOUND";
}

export function useAiWorkspaceController({ video }: UseAiWorkspaceControllerOptions) {
  const [workspace, setWorkspace] = useState<AiWorkspaceDTO | null>(null);
  const [stage, setStage] = useState<AiWorkspaceStage>("analysis");
  const [transcriptText, setTranscriptText] = useState("");
  const [manualSelection, setManualSelection] = useState<SelectedTextRange | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftDirty, setDraftDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAnnotationIdRef = useRef<string | null>(null);

  const resetToInitialWorkspace = useCallback((sourceVideo: DouyinVideoDTO) => {
    startTransition(() => {
      setWorkspace(null);
      setStage("analysis");
      setTranscriptText(buildInitialTranscript(sourceVideo));
      setManualSelection(null);
      setActiveAnnotationId(null);
      setDraft("");
      setDraftDirty(false);
    });
  }, []);

  const annotations = useMemo(
    () => mapWorkspaceAnnotations(workspace),
    [workspace],
  );
  const confirmed = workspace?.transcript?.isConfirmed ?? false;
  const locked = confirmed || annotations.length > 0;
  const canGenerate = Boolean(video?.shareUrl);
  const focusState: AiWorkspaceFocusState = manualSelection
    ? "selecting"
    : activeAnnotationId
      ? "focused"
      : "browsing";

  useEffect(() => {
    activeAnnotationIdRef.current = activeAnnotationId;
  }, [activeAnnotationId]);

  const applyWorkspace = useCallback(function applyWorkspace(
    next: AiWorkspaceDTO,
    sourceVideo: DouyinVideoDTO,
    options?: ApplyWorkspaceOptions,
  ) {
    const nextTranscript =
      next.transcript?.currentText ??
      next.transcript?.originalText ??
      buildInitialTranscript(sourceVideo);
    const nextAnnotations = mapWorkspaceAnnotations(next);
    const resolvedActiveAnnotationId =
      options?.nextActiveAnnotationId === undefined
        ? nextAnnotations.some((annotation) => annotation.id === activeAnnotationIdRef.current)
          ? activeAnnotationIdRef.current
          : null
        : options.nextActiveAnnotationId;

    startTransition(() => {
      setWorkspace(next);
      setTranscriptText(nextTranscript);
      setDraft(next.rewriteDraft?.currentDraft ?? "");
      setDraftDirty(false);
      setManualSelection(options?.nextSelection ?? null);
      setActiveAnnotationId(resolvedActiveAnnotationId);
      if (options?.nextStage) {
        setStage(options.nextStage);
      } else if (!options?.preserveStage) {
        setStage("analysis");
      }
    });
  }, []);

  useEffect(() => {
    if (!video) {
      return;
    }

    const currentVideo = video;
    let cancelled = false;

    async function loadWorkspace() {
      setLoadingWorkspace(true);
      try {
        const next = await apiClient.get<AiWorkspaceDTO>(`/ai-workspaces?videoId=${currentVideo.id}`);
        if (!cancelled) {
          applyWorkspace(next, currentVideo, { nextStage: "analysis", nextActiveAnnotationId: null });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (isWorkspaceMissing(error)) {
          try {
            const ensured = await apiClient.post<AiWorkspaceDTO>("/ai-workspaces", {
              videoId: currentVideo.id,
            });
            if (!cancelled) {
              applyWorkspace(ensured, currentVideo, {
                nextStage: "analysis",
                nextActiveAnnotationId: null,
              });
            }
            return;
          } catch (ensureError) {
            if (!cancelled) {
              toast.error(
                ensureError instanceof ApiError ? ensureError.message : "AI 工作台加载失败",
              );
              resetToInitialWorkspace(currentVideo);
            }
            return;
          }
        }

        toast.error(error instanceof ApiError ? error.message : "AI 工作台加载失败");
        resetToInitialWorkspace(currentVideo);
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
  }, [applyWorkspace, resetToInitialWorkspace, video]);

  useEffect(() => {
    if (!workspace?.id || stage !== "rewrite" || !draftDirty) {
      return;
    }

    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }

    draftSaveTimerRef.current = setTimeout(() => {
      setSavingDraft(true);
      void apiClient
        .patch<AiWorkspaceDTO>(`/ai-workspaces/${workspace.id}/rewrite-draft`, {
          currentDraft: draft,
        })
        .then((next) => {
          if (!video) {
            return;
          }
          applyWorkspace(next, video, {
            preserveStage: true,
            nextSelection: manualSelection,
            nextActiveAnnotationId: activeAnnotationId,
          });
        })
        .catch((error) => {
          toast.error(error instanceof ApiError ? error.message : "仿写草稿保存失败");
        })
        .finally(() => {
          setSavingDraft(false);
        });
    }, 500);

    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [activeAnnotationId, applyWorkspace, draft, draftDirty, manualSelection, stage, video, workspace?.id]);

  const handleGenerateTranscript = useCallback(function handleGenerateTranscript() {
    if (!video) {
      return;
    }

    setLoadingWorkspace(true);
    void apiClient
      .post<AiWorkspaceDTO>("/ai-workspaces/transcribe", {
        videoId: video.id,
      })
      .then((next) => applyWorkspace(next, video, { preserveStage: true }))
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : "发起转录失败");
      })
      .finally(() => {
        setLoadingWorkspace(false);
      });
  }, [video, applyWorkspace]);

  const confirmTranscript = useCallback(async function confirmTranscript(): Promise<AiWorkspaceDTO | null> {
    if (!workspace?.id || !video) {
      return null;
    }

    const payload = buildTranscriptPayload(transcriptText);
    const saved = await apiClient.patch<AiWorkspaceDTO>(
      `/ai-workspaces/${workspace.id}/transcript`,
      payload,
    );
    const confirmedWorkspace = await apiClient.post<AiWorkspaceDTO>(
      `/ai-workspaces/${workspace.id}/transcript/confirm`,
      {},
    );
    applyWorkspace(confirmedWorkspace, video, {
      preserveStage: true,
      nextActiveAnnotationId: null,
      nextSelection: null,
    });

    return confirmedWorkspace ?? saved;
  }, [applyWorkspace, transcriptText, video, workspace?.id]);

  const handleToggleLock = useCallback(function handleToggleLock() {
    if (locked) {
      setUnlockDialogOpen(true);
      return;
    }

    void confirmTranscript().catch((error) => {
      toast.error(error instanceof ApiError ? error.message : "锁定转录稿失败");
    });
  }, [confirmTranscript, locked]);

  const handleUnlockTranscript = useCallback(function handleUnlockTranscript() {
    setUnlockDialogOpen(false);
    if (!workspace?.id || !video) {
      return;
    }

    void apiClient
      .post<AiWorkspaceDTO>(`/ai-workspaces/${workspace.id}/transcript/unlock`, {})
      .then((next) =>
        applyWorkspace(next, video, {
          nextStage: "analysis",
          nextSelection: null,
          nextActiveAnnotationId: null,
        }),
      )
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : "解锁编辑失败");
      });
  }, [applyWorkspace, video, workspace?.id]);

  const handleSelectRange = useCallback(function handleSelectRange(range: SelectedTextRange) {
    setManualSelection(range);
    setActiveAnnotationId(null);
  }, []);

  const handleClearSelection = useCallback(function handleClearSelection() {
    setManualSelection(null);
  }, []);

  const handleToggleAnnotationFocus = useCallback(function handleToggleAnnotationFocus(annotationId: string) {
    setManualSelection(null);
    setActiveAnnotationId((current) => (current === annotationId ? null : annotationId));
  }, []);

  const handleCreateAnnotation = useCallback(function handleCreateAnnotation(content: string) {
    if (!workspace?.id || !video || !manualSelection || !content.trim()) {
      return;
    }

    const payload: SaveAnnotationInput = {
      segmentId: manualSelection.segmentId,
      startOffset: manualSelection.startOffset,
      endOffset: manualSelection.endOffset,
      quotedText: manualSelection.quotedText,
      function: content.trim(),
      note: content.trim(),
    };

    void apiClient
      .post<AiWorkspaceDTO>(`/ai-workspaces/${workspace.id}/annotations`, payload)
      .then((next) => {
        const createdAnnotationId = findLatestAnnotationId(next, manualSelection, content);
        applyWorkspace(next, video, {
          preserveStage: true,
          nextSelection: null,
          nextActiveAnnotationId: createdAnnotationId,
        });
      })
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : "保存拆解失败");
      });
  }, [applyWorkspace, manualSelection, video, workspace?.id]);

  const handleToggleRewriteStage = useCallback(function handleToggleRewriteStage() {
    if (stage === "rewrite") {
      setStage("analysis");
      return;
    }

    if (!workspace?.id) {
      toast.error("请先完成 AI 转录");
      return;
    }

    const continueToRewrite = () =>
      apiClient.patch<AiWorkspaceDTO>(`/ai-workspaces/${workspace.id}/rewrite-draft`, {
        currentDraft: draft,
      });

    const request = confirmed
      ? continueToRewrite()
      : apiClient
          .patch<AiWorkspaceDTO>(
            `/ai-workspaces/${workspace.id}/transcript`,
            buildTranscriptPayload(transcriptText),
          )
          .then(() => apiClient.post<AiWorkspaceDTO>(`/ai-workspaces/${workspace.id}/transcript/confirm`, {}))
          .then(() => continueToRewrite());

    void request
      .then((next) => {
        if (!video) {
          return;
        }
        applyWorkspace(next, video, {
          nextStage: "rewrite",
          nextSelection: manualSelection,
          nextActiveAnnotationId: activeAnnotationId,
        });
      })
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : "进入仿写态失败");
      });
  }, [activeAnnotationId, applyWorkspace, confirmed, draft, manualSelection, stage, transcriptText, video, workspace?.id]);

  const handleDraftChange = useCallback((next: string) => {
    setDraft(next);
    setDraftDirty(true);
  }, []);

  return {
    stage,
    focusState,
    workspace,
    transcriptText,
    annotations,
    draft,
    canGenerate,
    loadingWorkspace,
    locked,
    previewOpen,
    unlockDialogOpen,
    selectedRange: manualSelection,
    activeAnnotationId,
    savingDraft,
    setPreviewOpen,
    setUnlockDialogOpen,
    setTranscriptText,
    setDraft: handleDraftChange,
    handleGenerateTranscript,
    handleToggleLock,
    handleUnlockTranscript,
    handleSelectRange,
    handleClearSelection,
    handleToggleAnnotationFocus,
    handleCreateAnnotation,
    handleToggleRewriteStage,
  };
}
