"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { DouyinVideoDTO } from "@/types/douyin-account";
import type {
  AiWorkspaceDTO,
  GenerateRewriteInput,
  RewriteDTO,
  SaveAnnotationInput,
  SaveTranscriptInput,
} from "@/types/ai-workspace";
import { ApiError, apiClient } from "@/lib/api-client";

import {
  mapWorkspaceAnnotations,
  splitTranscriptIntoSegments,
  type SelectedTextRange,
} from "./ai-workspace-view-model";
import {
  applyTranscriptStreamEvent,
  createTranscriptStreamState,
} from "./ai-workspace-transcript-stream";

export type AiWorkspaceStage = "transcribe" | "decompose" | "rewrite";
type DestructiveAction = "unlock" | "retranscribe";
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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function resolveWorkspaceStage(workspace: AiWorkspaceDTO | null): AiWorkspaceStage {
  if (!workspace) {
    return "transcribe";
  }

  if (workspace.status === "REWRITING" || workspace.enteredRewriteAt || workspace.rewriteDraft) {
    return "rewrite";
  }

  if (
    workspace.status === "TRANSCRIPT_CONFIRMED" ||
    workspace.status === "DECOMPOSED" ||
    workspace.transcript?.isConfirmed ||
    workspace.annotations.length > 0
  ) {
    return "decompose";
  }

  return "transcribe";
}

function hasWorkspaceDocument(
  workspace: AiWorkspaceDTO | null,
  transcriptText: string,
): boolean {
  return Boolean(
    transcriptText.trim() ||
      workspace?.segments.length ||
      workspace?.annotations.length ||
      workspace?.transcript?.originalText?.trim() ||
      workspace?.transcript?.currentText?.trim(),
  );
}

export function useAiWorkspaceController({ video }: UseAiWorkspaceControllerOptions) {
  const [workspace, setWorkspace] = useState<AiWorkspaceDTO | null>(null);
  const [stage, setStage] = useState<AiWorkspaceStage>("transcribe");
  const [transcriptText, setTranscriptText] = useState("");
  const [manualSelection, setManualSelection] = useState<SelectedTextRange | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftDirty, setDraftDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [destructiveAction, setDestructiveAction] = useState<DestructiveAction>("unlock");
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [selectedFragmentIds, setSelectedFragmentIds] = useState<string[]>([]);
  const [rewrite, setRewrite] = useState<RewriteDTO | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [generatingRewrite, setGeneratingRewrite] = useState(false);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewritePollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAnnotationIdRef = useRef<string | null>(null);
  const pollVersionRef = useRef<number>(0);

  const resetToInitialWorkspace = useCallback(() => {
    if (rewritePollTimerRef.current) {
      clearTimeout(rewritePollTimerRef.current);
      rewritePollTimerRef.current = null;
    }
    pollVersionRef.current++; // invalidate any ongoing poll
    startTransition(() => {
      setWorkspace(null);
      setStage("transcribe");
      setTranscriptText("");
      setManualSelection(null);
      setActiveAnnotationId(null);
      setDraft("");
      setDraftDirty(false);
      setSelectedFragmentIds([]);
      setRewrite(null);
      setActiveVersionId(null);
      setGeneratingRewrite(false);
    });
  }, []);

  const annotations = useMemo(
    () => mapWorkspaceAnnotations(workspace),
    [workspace],
  );
  const confirmed = workspace?.transcript?.isConfirmed ?? false;
  const locked = confirmed || annotations.length > 0;
  const canGenerate = stage !== "rewrite";
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
    _sourceVideo: DouyinVideoDTO,
    options?: ApplyWorkspaceOptions,
  ) {
    const nextTranscript =
      next.transcript?.currentText ??
      next.transcript?.originalText ??
      "";
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
      setSelectedFragmentIds([]);
      if (options?.nextStage) {
        setStage(options.nextStage);
      } else if (!options?.preserveStage) {
        setStage(resolveWorkspaceStage(next));
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
          applyWorkspace(next, currentVideo, {
            nextStage: resolveWorkspaceStage(next),
            nextActiveAnnotationId: null,
          });
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
                nextStage: resolveWorkspaceStage(ensured),
                nextActiveAnnotationId: null,
              });
            }
            return;
          } catch (ensureError) {
            if (!cancelled) {
              toast.error(
                ensureError instanceof ApiError ? ensureError.message : "AI 工作台加载失败",
              );
              resetToInitialWorkspace();
            }
            return;
          }
        }

        toast.error(error instanceof ApiError ? error.message : "AI 工作台加载失败");
        resetToInitialWorkspace();
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
    if (!video || !workspace?.id || workspace.status !== "TRANSCRIBING") {
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;
    let streamState = createTranscriptStreamState(
      workspace.transcript?.currentText ?? workspace.transcript?.originalText ?? "",
    );

    const syncWorkspace = async () => {
      try {
        const next = await apiClient.get<AiWorkspaceDTO>(`/ai-workspaces?videoId=${video.id}`);
        if (cancelled) {
          return;
        }

        applyWorkspace(next, video, {
          preserveStage: true,
          nextSelection: manualSelection,
          nextActiveAnnotationId: activeAnnotationIdRef.current,
        });
      } catch (error) {
        if (cancelled || isAbortError(error)) {
          return;
        }

        toast.error(error instanceof ApiError ? error.message : "AI 工作台刷新失败");
      }
    };

    void apiClient
      .stream(
        `/ai-workspaces/${workspace.id}/transcript/sse`,
        {
          method: "GET",
          signal: abortController.signal,
        },
        (message) => {
          streamState = applyTranscriptStreamEvent(streamState, message);

          if (
            message.event === "start" ||
            message.event === "delta" ||
            message.event === "done"
          ) {
            setTranscriptText(streamState.text);
          }

          if (message.event === "done") {
            void syncWorkspace();
            return;
          }

          if (message.event === "error" && streamState.errorMessage) {
            toast.error(streamState.errorMessage);
            void syncWorkspace();
          }
        },
      )
      .catch((error) => {
        if (cancelled || isAbortError(error)) {
          return;
        }

        toast.error(error instanceof ApiError ? error.message : "转录流连接失败");
        void syncWorkspace();
      });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [applyWorkspace, manualSelection, video, workspace?.id, workspace?.status, workspace?.transcript?.currentText, workspace?.transcript?.originalText]);

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

  // ─── Rewrite Stage: load & poll ───────────────────────────────────────────

  // Reset rewrite state when video changes
  useEffect(() => {
    setRewrite(null);
    setActiveVersionId(null);
    setGeneratingRewrite(false);
    if (rewritePollTimerRef.current) {
      clearTimeout(rewritePollTimerRef.current);
      rewritePollTimerRef.current = null;
    }
    pollVersionRef.current++; // invalidate any ongoing poll
  }, [video?.id]);

  // Load rewrite when entering rewrite stage
  useEffect(() => {
    if (stage !== "rewrite" || !video) return;

    let cancelled = false;

    void apiClient
      .get<{ rewrite: RewriteDTO | null }>(`/ai-workspace/${video.id}/rewrite`)
      .then((result) => {
        if (cancelled) return;
        setRewrite(result.rewrite);
        setActiveVersionId((prev) => prev ?? result.rewrite?.versions[0]?.id ?? null);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(error instanceof ApiError ? error.message : "仿写数据加载失败");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, video?.id]);

  // Cleanup rewrite poll on unmount
  useEffect(() => {
    return () => {
      if (rewritePollTimerRef.current) {
        clearTimeout(rewritePollTimerRef.current);
        rewritePollTimerRef.current = null;
      }
    };
  }, []);

  // ─── Rewrite Methods ─────────────────────────────────────────────────────

  const startRewritePoll = useCallback(
    function startRewritePoll(targetVersionId: string) {
      if (!video) return;

      if (rewritePollTimerRef.current) {
        clearTimeout(rewritePollTimerRef.current);
        rewritePollTimerRef.current = null;
      }

      const pollVersion = ++pollVersionRef.current;

      const poll = async () => {
        try {
          const result = await apiClient.get<{ rewrite: RewriteDTO | null }>(
            `/ai-workspace/${video.id}/rewrite`,
          );
          if (pollVersionRef.current !== pollVersion) return;
          setRewrite(result.rewrite);

          const targetVersion = result.rewrite?.versions.find((v) => v.id === targetVersionId);

          if (!targetVersion || targetVersion.status === "GENERATING") {
            rewritePollTimerRef.current = setTimeout(() => void poll(), 2000);
          } else {
            setGeneratingRewrite(false);
            setActiveVersionId(targetVersionId);
          }
        } catch {
          if (pollVersionRef.current !== pollVersion) return;
          rewritePollTimerRef.current = setTimeout(() => void poll(), 3000);
        }
      };

      rewritePollTimerRef.current = setTimeout(() => void poll(), 2000);
    },
    [video],
  );

  const generateRewrite = useCallback(
    async function generateRewrite(input: GenerateRewriteInput) {
      if (!video) return;

      setGeneratingRewrite(true);
      try {
        const result = await apiClient.post<{ rewriteVersionId: string; versionNumber: number }>(
          `/ai-workspace/${video.id}/rewrite/generate`,
          input,
        );
        startRewritePoll(result.rewriteVersionId);
      } catch (error) {
        setGeneratingRewrite(false);
        toast.error(error instanceof ApiError ? error.message : "发起仿写失败");
      }
    },
    [video, startRewritePoll],
  );

  const saveVersionEdit = useCallback(
    async function saveVersionEdit(versionId: string, content: string) {
      if (!video) return;
      try {
        const result = await apiClient.patch<{
          id: string;
          editedContent: string;
          updatedAt: string;
        }>(`/ai-workspace/${video.id}/rewrite/versions/${versionId}`, { editedContent: content });
        setRewrite((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            versions: prev.versions.map((v) =>
              v.id === result.id
                ? { ...v, editedContent: result.editedContent, updatedAt: result.updatedAt }
                : v,
            ),
          };
        });
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "保存仿写编辑失败");
      }
    },
    [video],
  );

  const requestTranscription = useCallback(function requestTranscription() {
    if (!video) {
      return;
    }

    setLoadingWorkspace(true);
    void apiClient
      .post<AiWorkspaceDTO>("/ai-workspaces/transcribe", {
        videoId: video.id,
      })
      .then((next) =>
        applyWorkspace(next, video, {
          nextStage: "transcribe",
          nextSelection: null,
          nextActiveAnnotationId: null,
        }),
      )
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : "发起转录失败");
      })
      .finally(() => {
        setLoadingWorkspace(false);
      });
  }, [applyWorkspace, video]);

  const handleGenerateTranscript = useCallback(function handleGenerateTranscript() {
    if (!video) {
      return;
    }

    if (stage === "rewrite") {
      toast.error("已进入仿写阶段，不能回到转录和拆解状态");
      return;
    }

    if (hasWorkspaceDocument(workspace, transcriptText)) {
      setDestructiveAction("retranscribe");
      setUnlockDialogOpen(true);
      return;
    }

    requestTranscription();
  }, [requestTranscription, stage, transcriptText, video, workspace]);

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
      nextStage: "decompose",
      nextActiveAnnotationId: null,
      nextSelection: null,
    });

    return confirmedWorkspace ?? saved;
  }, [applyWorkspace, transcriptText, video, workspace?.id]);

  const handleToggleLock = useCallback(function handleToggleLock() {
    if (locked) {
      setDestructiveAction("unlock");
      setUnlockDialogOpen(true);
      return;
    }

    if (!transcriptText.trim()) {
      toast.error("请先生成或录入转录稿，再进入拆解分析");
      return;
    }

    void confirmTranscript().catch((error) => {
      toast.error(error instanceof ApiError ? error.message : "锁定转录稿失败");
    });
  }, [confirmTranscript, locked, transcriptText]);

  const handleUnlockDialogOpenChange = useCallback(function handleUnlockDialogOpenChange(open: boolean) {
    setUnlockDialogOpen(open);
    if (!open) {
      setDestructiveAction("unlock");
    }
  }, []);

  const handleConfirmDestructiveAction = useCallback(function handleConfirmDestructiveAction() {
    setUnlockDialogOpen(false);

    if (destructiveAction === "retranscribe") {
      setDestructiveAction("unlock");
      requestTranscription();
      return;
    }

    if (!workspace?.id || !video) {
      return;
    }

    void apiClient
      .post<AiWorkspaceDTO>(`/ai-workspaces/${workspace.id}/transcript/unlock`, {})
      .then((next) =>
        applyWorkspace(next, video, {
          nextStage: "transcribe",
          nextSelection: null,
          nextActiveAnnotationId: null,
        }),
      )
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : "解锁编辑失败");
      });
  }, [applyWorkspace, destructiveAction, requestTranscription, video, workspace?.id]);

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

  const handleEnterRewriteStage = useCallback(function handleEnterRewriteStage() {
    if (stage === "rewrite") {
      return;
    }

    if (!workspace?.id) {
      toast.error("请先完成 AI 转录");
      return;
    }

    if (!transcriptText.trim()) {
      toast.error("请先生成或录入转录稿，再进入仿写态");
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

  const handleFragmentToggle = useCallback((id: string) => {
    setSelectedFragmentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleFragmentsClear = useCallback(() => {
    setSelectedFragmentIds([]);
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
    destructiveAction,
    selectedRange: manualSelection,
    activeAnnotationId,
    savingDraft,
    setPreviewOpen,
    handleUnlockDialogOpenChange,
    setTranscriptText,
    setDraft: handleDraftChange,
    handleGenerateTranscript,
    handleToggleLock,
    handleConfirmDestructiveAction,
    handleSelectRange,
    handleClearSelection,
    handleToggleAnnotationFocus,
    handleCreateAnnotation,
    handleEnterRewriteStage,
    selectedFragmentIds,
    handleFragmentToggle,
    handleFragmentsClear,
    rewrite,
    activeVersionId,
    generatingRewrite,
    onGenerateRewrite: generateRewrite,
    onSaveVersionEdit: saveVersionEdit,
    onSetActiveVersionId: setActiveVersionId,
  };
}
