"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { AiSettingsDTO } from "@/types/ai-config";
import type {
  DirectGenerateRewriteInput,
  RewriteDTO,
  RewriteVersionDTO,
} from "@/types/ai-workspace";
import type { PaginatedData, CursorPaginatedData } from "@/types/api";
import type { DouyinAccountDTO } from "@/types/douyin-account";
import type { FragmentDTO } from "@/types/fragment";
import { apiClient } from "@/lib/api-client";
import { useDirectCreateLocalState } from "@/lib/hooks/use-direct-create-local-state";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";

import { DirectCreatePanel } from "./direct-create-panel";

interface DirectRewriteResponse {
  rewrite: RewriteDTO;
}

interface DirectGenerateResponse {
  rewriteId: string;
  rewriteVersionId: string;
  versionNumber: number;
}

function getPreferredRewriteModelId(settings: AiSettingsDTO): string | null {
  const rewriteBinding = settings.bindings.find((binding) => binding.step === "REWRITE");
  return rewriteBinding?.modelConfigId ?? settings.modelConfigs[0]?.id ?? null;
}

function updateVersion(
  rewrite: RewriteDTO | null,
  versionId: string,
  patch: Partial<RewriteVersionDTO>,
): RewriteDTO | null {
  if (!rewrite) {
    return rewrite;
  }

  return {
    ...rewrite,
    versions: rewrite.versions.map((version) =>
      version.id === versionId ? { ...version, ...patch } : version,
    ),
  };
}

export function DirectCreatePage() {
  const local = useDirectCreateLocalState();
  const [accounts, setAccounts] = useState<DouyinAccountDTO[]>([]);
  const [settings, setSettings] = useState<AiSettingsDTO | null>(null);
  const [selectedFragments, setSelectedFragments] = useState<FragmentDTO[]>([]);
  const [rewrite, setRewrite] = useState<RewriteDTO | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [generating, setGenerating] = useState(false);
  // Tracks rewriteIds that handleGenerate already loads, to skip redundant restoration effect fetch.
  const pendingLoadRef = useRef<string | null>(null);

  const modelConfigs = useMemo(() => settings?.modelConfigs ?? [], [settings?.modelConfigs]);

  const loadRewrite = useCallback(
    async (rewriteId: string, preferredVersionId?: string): Promise<RewriteDTO | null> => {
      const result = await apiClient.get<DirectRewriteResponse>(`/rewrites/direct/${rewriteId}`);
      setRewrite(result.rewrite);
      const nextActiveVersionId =
        preferredVersionId ??
        result.rewrite.versions.find((version) => version.status === "GENERATING")?.id ??
        result.rewrite.versions[0]?.id ??
        null;
      setActiveVersionId(nextActiveVersionId);
      return result.rewrite;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingAccounts(true);
    void apiClient
      .get<PaginatedData<DouyinAccountDTO>>("/douyin-accounts?limit=100")
      .then((result) => {
        if (!cancelled) {
          setAccounts(result.items);
          if (!local.state.targetAccountId && result.items[0]) {
            local.setTargetAccountId(result.items[0].id);
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "账号列表加载失败");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingAccounts(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.hydrated]);

  useEffect(() => {
    let cancelled = false;
    setLoadingSettings(true);
    void apiClient
      .get<AiSettingsDTO>("/ai-config/settings")
      .then((result) => {
        if (!cancelled) {
          setSettings(result);
          if (!local.state.modelConfigId) {
            local.setModelConfigId(getPreferredRewriteModelId(result));
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "AI 配置加载失败");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSettings(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.hydrated]);

  // Restore selected fragment objects from localStorage IDs once on hydration.
  // Subsequent picker interactions update selectedFragments directly via onSetSelectedFragments,
  // so this effect must NOT re-run on every fragmentIds change to avoid redundant API calls.
  useEffect(() => {
    if (!local.hydrated) {
      return;
    }

    const fragmentIds = local.state.fragmentIds;
    if (fragmentIds.length === 0) {
      setSelectedFragments([]);
      return;
    }

    let cancelled = false;
    void apiClient
      .get<CursorPaginatedData<FragmentDTO>>("/viewpoints?limit=100&scope=today")
      .then((result) => {
        if (cancelled) {
          return;
        }

        const fragmentMap = new Map(result.items.map((item) => [item.id, item]));
        setSelectedFragments(
          fragmentIds
            .map((id) => fragmentMap.get(id))
            .filter((fragment): fragment is FragmentDTO => fragment !== undefined),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedFragments([]);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.hydrated]);

  useEffect(() => {
    if (!local.hydrated || !local.state.currentRewriteId) {
      return;
    }

    // Skip if handleGenerate already initiated a load for this rewriteId.
    if (pendingLoadRef.current === local.state.currentRewriteId) {
      return;
    }

    let cancelled = false;
    void loadRewrite(local.state.currentRewriteId)
      .catch((error) => {
        if (!cancelled) {
          local.clearCurrentTask();
          setRewrite(null);
          setActiveVersionId(null);
          toast.error(error instanceof Error ? error.message : "直接创作任务恢复失败");
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.hydrated, local.state.currentRewriteId, loadRewrite]);

  useEffect(() => {
    if (!rewrite || !local.state.currentRewriteId) {
      setGenerating(false);
      return;
    }

    const hasGeneratingVersion = rewrite.versions.some(
      (version) => version.status === "GENERATING",
    );
    setGenerating(hasGeneratingVersion);
    if (!hasGeneratingVersion) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadRewrite(local.state.currentRewriteId ?? "").catch((error) => {
        toast.error(error instanceof Error ? error.message : "生成状态刷新失败");
      });
    }, 2000);

    return () => window.clearInterval(timer);
  }, [loadRewrite, local.state.currentRewriteId, rewrite]);

  const handleGenerate = useCallback(
    (input: DirectGenerateRewriteInput) => {
      setGenerating(true);
      void apiClient
        .post<DirectGenerateResponse>("/rewrites/direct/generate", input)
        .then(async (result) => {
          // Mark this rewriteId as being loaded here so the restoration effect skips it.
          pendingLoadRef.current = result.rewriteId;
          local.setCurrentRewriteId(result.rewriteId);
          await loadRewrite(result.rewriteId, result.rewriteVersionId);
        })
        .catch((error) => {
          toast.error(error instanceof Error ? error.message : "直接创作发起失败");
          setGenerating(false);
        });
    },
    [loadRewrite, local],
  );

  const handleSaveVersionEdit = useCallback(
    (versionId: string, content: string) => {
      if (!local.state.currentRewriteId) {
        return;
      }

      void apiClient
        .patch<{ id: string; editedContent: string; updatedAt: string }>(
          `/rewrites/direct/${local.state.currentRewriteId}/versions/${versionId}`,
          { editedContent: content },
        )
        .then((result) => {
          setRewrite((current) =>
            updateVersion(current, versionId, {
              editedContent: result.editedContent,
              updatedAt: result.updatedAt,
            }),
          );
        })
        .catch((error) => {
          toast.error(error instanceof Error ? error.message : "编辑保存失败");
        });
    },
    [local.state.currentRewriteId],
  );

  const handleNewTask = useCallback(() => {
    local.clearCurrentTask();
    setRewrite(null);
    setActiveVersionId(null);
    setGenerating(false);
  }, [local]);

  const handleSetFinalVersion = useCallback(
    async (versionId: string) => {
      if (!rewrite) return;

      const previousRewrite = rewrite;
      setRewrite((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          versions: prev.versions.map((v) => ({
            ...v,
            isFinalVersion: v.id === versionId,
          })),
        };
      });

      try {
        await apiClient.patch(`/rewrites/direct/${rewrite.id}/versions/${versionId}/final`);
      } catch (error) {
        setRewrite(previousRewrite);
        toast.error(error instanceof Error ? error.message : "操作失败，请重试");
      }
    },
    [rewrite],
  );

  return (
    <DashboardPageShell
      eyebrow="AI 仿写"
      title="直接创作"
      description="不依赖对标视频，直接输入主题和观点生成短视频文案。"
      maxWidth="wide"
    >
      <DirectCreatePanel
        localState={local.state}
        selectedFragments={selectedFragments}
        accounts={accounts}
        modelConfigs={modelConfigs}
        rewrite={rewrite}
        activeVersionId={activeVersionId}
        loadingAccounts={loadingAccounts}
        loadingSettings={loadingSettings}
        generating={generating}
        onSetFragmentIds={local.setFragmentIds}
        onSetSelectedFragments={setSelectedFragments}
        onSetUserInputContent={local.setUserInputContent}
        onSetTopic={local.setTopic}
        onSetTargetAccountId={local.setTargetAccountId}
        onSetModelConfigId={local.setModelConfigId}
        onSetActiveVersionId={setActiveVersionId}
        onGenerate={handleGenerate}
        onSaveVersionEdit={handleSaveVersionEdit}
        onNewTask={handleNewTask}
        onSetFinalVersion={handleSetFinalVersion}
      />
    </DashboardPageShell>
  );
}
