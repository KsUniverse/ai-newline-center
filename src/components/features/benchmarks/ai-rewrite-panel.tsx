"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import type { PaginatedData } from "@/types/api";
import type { AiSettingsDTO } from "@/types/ai-config";
import type { DouyinAccountDTO } from "@/types/douyin-account";
import type { FragmentDTO } from "@/types/fragment";
import type { GenerateRewriteInput, RewriteDTO } from "@/types/ai-workspace";
import { apiClient } from "@/lib/api-client";
import { useRewriteLocalState } from "@/lib/hooks/use-rewrite-local-state";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { DecompositionAnnotation } from "./ai-workspace-view-model";
import { ViewpointPicker } from "./viewpoint-picker";

export interface AiRewritePanelProps {
  annotations: DecompositionAnnotation[];
  videoId: string;
  rewrite: RewriteDTO | null;
  activeVersionId: string | null;
  generatingRewrite: boolean;
  onGenerateRewrite: (input: GenerateRewriteInput) => void;
  onSaveVersionEdit: (versionId: string, content: string) => void;
  onSetActiveVersionId: (id: string) => void;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const AiRewritePanel = memo(function AiRewritePanel({
  annotations,
  videoId,
  rewrite,
  activeVersionId,
  generatingRewrite,
  onGenerateRewrite,
  onSaveVersionEdit,
  onSetActiveVersionId,
}: AiRewritePanelProps) {
  const {
    state: localState,
    setSelectedFragmentIds,
    setModelConfigId,
    setUserInputContent,
    setTargetAccountId,
  } = useRewriteLocalState(videoId);

  const [selectedFragments, setSelectedFragments] = useState<FragmentDTO[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const [accounts, setAccounts] = useState<DouyinAccountDTO[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettingsDTO | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingGenerateInput, setPendingGenerateInput] = useState<GenerateRewriteInput | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load accounts
  useEffect(() => {
    let cancelled = false;
    setLoadingAccounts(true);
    void apiClient
      .get<PaginatedData<DouyinAccountDTO>>("/douyin-accounts?limit=100")
      .then((result) => {
        if (!cancelled) setAccounts(result.items);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "账号列表加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoadingAccounts(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load AI settings
  useEffect(() => {
    let cancelled = false;
    setLoadingSettings(true);
    void apiClient
      .get<AiSettingsDTO>("/ai-config/settings")
      .then((result) => {
        if (!cancelled) {
          setAiSettings(result);
          // Default to REWRITE step model if not already selected
          if (!localState.modelConfigId) {
            const rewriteBinding = result.bindings.find((b) => b.step === "REWRITE");
            if (rewriteBinding?.modelConfigId) {
              setModelConfigId(rewriteBinding.modelConfigId);
            } else if (result.modelConfigs.length > 0 && result.modelConfigs[0]) {
              setModelConfigId(result.modelConfigs[0].id);
            }
          }
        }
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "AI 配置加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoadingSettings(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync edit content when active version changes
  const activeVersion = useMemo(
    () => rewrite?.versions.find((v) => v.id === activeVersionId) ?? null,
    [rewrite, activeVersionId],
  );

  useEffect(() => {
    if (!activeVersion) {
      setEditContent("");
      return;
    }
    setEditContent(activeVersion.editedContent ?? activeVersion.generatedContent ?? "");
  }, [activeVersion]);

  const handleEditChange = useCallback(
    (value: string) => {
      setEditContent(value);
      if (!activeVersionId || activeVersion?.status !== "COMPLETED") return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSaveVersionEdit(activeVersionId, value);
      }, 1000);
    },
    [activeVersionId, activeVersion?.status, onSaveVersionEdit],
  );

  const handleViewpointConfirm = useCallback(
    (ids: string[], fragments: FragmentDTO[]) => {
      setSelectedFragmentIds(ids);
      setSelectedFragments(fragments);
    },
    [setSelectedFragmentIds],
  );

  const handleRemoveFragment = useCallback(
    (id: string) => {
      const next = localState.selectedFragmentIds.filter((x) => x !== id);
      setSelectedFragmentIds(next);
      setSelectedFragments((prev) => prev.filter((f) => f.id !== id));
    },
    [localState.selectedFragmentIds, setSelectedFragmentIds],
  );

  const buildGenerateInput = useCallback((): GenerateRewriteInput | null => {
    if (!localState.targetAccountId || !localState.modelConfigId) return null;
    return {
      targetAccountId: localState.targetAccountId,
      modelConfigId: localState.modelConfigId,
      usedFragmentIds: localState.selectedFragmentIds,
      userInputContent: localState.userInputContent || undefined,
    };
  }, [localState]);

  const handleGenerateClick = useCallback(() => {
    const input = buildGenerateInput();
    if (!input) return;

    // If current version has edited content, confirm before generating
    if (activeVersion?.editedContent) {
      setPendingGenerateInput(input);
      setConfirmDialogOpen(true);
      return;
    }

    onGenerateRewrite(input);
  }, [buildGenerateInput, activeVersion?.editedContent, onGenerateRewrite]);

  const handleConfirmGenerate = useCallback(() => {
    setConfirmDialogOpen(false);
    if (pendingGenerateInput) {
      onGenerateRewrite(pendingGenerateInput);
      setPendingGenerateInput(null);
    }
  }, [pendingGenerateInput, onGenerateRewrite]);

  const isGenerateDisabled =
    annotations.length === 0 ||
    !localState.targetAccountId ||
    !localState.modelConfigId ||
    generatingRewrite ||
    (rewrite?.versions.some((v) => v.status === "GENERATING") ?? false);

  const displayedChips = chipsExpanded
    ? selectedFragments
    : selectedFragments.slice(0, 5);

  const modelConfigs = aiSettings?.modelConfigs ?? [];

  // Derive textarea placeholder and disabled state
  let textareaPlaceholder = "点击「仿写」生成 AI 文案";
  let textareaDisabled = false;

  if (generatingRewrite || activeVersion?.status === "GENERATING") {
    textareaPlaceholder = "AI 正在生成...";
    textareaDisabled = true;
  } else if (!activeVersion) {
    textareaPlaceholder = "点击「仿写」生成 AI 文案";
    textareaDisabled = false;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-5">
      {/* Viewpoint selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs font-medium text-muted-foreground/80 uppercase tracking-[0.18em]">
            今日观点
          </Label>
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-lg px-3 text-xs"
            onClick={() => setPickerOpen(true)}
          >
            选择今日观点
          </Button>
        </div>

        {displayedChips.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {displayedChips.map((fragment) => (
              <span
                key={fragment.id}
                className="inline-flex max-w-60 items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-foreground/90 shadow-sm"
              >
                <span className="truncate">
                  {fragment.content.length > 30
                    ? `${fragment.content.slice(0, 30)}...`
                    : fragment.content}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveFragment(fragment.id)}
                  className="ml-0.5 shrink-0 rounded-full text-muted-foreground/60 hover:text-foreground transition-colors"
                  aria-label="移除"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {selectedFragments.length > 5 && (
              <button
                type="button"
                onClick={() => setChipsExpanded((p) => !p)}
                className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground/80 hover:text-foreground transition-colors"
              >
                {chipsExpanded
                  ? "收折"
                  : `+${selectedFragments.length - 5} 条`}
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/60 leading-5">
            未选择观点（0 条也可发起生成）
          </p>
        )}
      </div>

      {/* Temporary material input */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground/80 uppercase tracking-[0.18em]">
          临时素材（不入观点库）
        </Label>
        <Textarea
          value={localState.userInputContent}
          onChange={(e) => setUserInputContent(e.target.value)}
          maxLength={500}
          placeholder="输入金句、例子、数据等，直接参与本次仿写"
          className="min-h-20 resize-none rounded-2xl border-border/60 bg-background/80 text-sm leading-6 placeholder:text-muted-foreground/50"
        />
        <p className="text-right text-xs text-muted-foreground/50">
          {localState.userInputContent.length}/500
        </p>
      </div>

      {/* Target account select */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground/80 uppercase tracking-[0.18em]">
          目标发布账号
        </Label>
        {loadingAccounts ? (
          <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground/60">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载中...
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 leading-5">
            请先在「我的账号」中添加抖音账号
          </p>
        ) : (
          <Select
            value={localState.targetAccountId ?? ""}
            onValueChange={(v) => setTargetAccountId(v || null)}
          >
            <SelectTrigger className="h-9 rounded-xl border-border/60 bg-background/80 text-sm">
              <SelectValue placeholder="选择目标发布账号" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/60 bg-card/95">
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id} className="rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    {account.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={account.avatar}
                        alt={account.nickname}
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-muted" />
                    )}
                    <span>{account.nickname}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* AI model select */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground/80 uppercase tracking-[0.18em]">
          生成模型
        </Label>
        {loadingSettings ? (
          <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground/60">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载中...
          </div>
        ) : modelConfigs.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 leading-5">
            请联系管理员配置 AI 模型
          </p>
        ) : (
          <Select
            value={localState.modelConfigId ?? ""}
            onValueChange={(v) => setModelConfigId(v || null)}
          >
            <SelectTrigger className="h-9 rounded-xl border-border/60 bg-background/80 text-sm">
              <SelectValue placeholder="选择生成模型" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/60 bg-card/95">
              {modelConfigs.map((config) => (
                <SelectItem key={config.id} value={config.id} className="rounded-lg text-sm">
                  {config.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Version panel */}
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs font-medium text-muted-foreground/80 uppercase tracking-[0.18em]">
          版本
        </Label>
        {rewrite && rewrite.versions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-foreground/90 shadow-sm hover:bg-background/90 transition-colors"
              >
                {activeVersion
                  ? `版本 ${activeVersion.versionNumber}`
                  : `版本 ${rewrite.versions[0]?.versionNumber ?? 1}`}
                <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-60 rounded-xl border-border/60 bg-card/95 p-1"
            >
              {rewrite.versions.map((version) => (
                <DropdownMenuItem
                  key={version.id}
                  onClick={() => onSetActiveVersionId(version.id)}
                  className={`flex cursor-pointer flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-sm ${activeVersionId === version.id ? "bg-primary/10 text-primary" : ""}`}
                >
                  <span className="font-medium">版本 {version.versionNumber}</span>
                  <span className="text-xs text-muted-foreground/70">
                    {formatDateTime(version.createdAt)}
                    {version.modelConfig ? ` · ${version.modelConfig.name}` : ""}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Badge
            variant="secondary"
            className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs shadow-sm"
          >
            暂无版本
          </Badge>
        )}
      </div>

      {/* Generate button */}
      <Button
        disabled={isGenerateDisabled || loadingAccounts || loadingSettings}
        onClick={handleGenerateClick}
        className="w-full rounded-xl"
        size="sm"
      >
        {generatingRewrite || activeVersion?.status === "GENERATING" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            生成中...
          </>
        ) : (
          "仿写"
        )}
      </Button>

      {/* No annotations hint */}
      {annotations.length === 0 && (
        <p className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-5 text-amber-500/90">
          请先完成拆解步骤，才能发起 AI 仿写
        </p>
      )}

      {/* Result editor */}
      <div className="flex min-h-40 flex-1 flex-col gap-2">
        {activeVersion?.status === "FAILED" ? (
          <div className="flex-1 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm text-destructive/90">
            <p className="font-medium">生成失败</p>
            {activeVersion.errorMessage && (
              <p className="mt-1 text-xs text-destructive/70">{activeVersion.errorMessage}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground/60">请重新点击「仿写」按钮重试</p>
          </div>
        ) : (
          <div className="relative flex flex-1 flex-col">
            {editContent.length > 0 && (
              <div className="absolute right-3 top-3 z-10">
                <Badge
                  variant="secondary"
                  className="rounded-full border border-border/60 bg-card/90 px-2 py-0.5 text-xs shadow-sm"
                >
                  {editContent.length} 字
                </Badge>
              </div>
            )}
            <Textarea
              value={editContent}
              onChange={(e) => handleEditChange(e.target.value)}
              disabled={textareaDisabled}
              placeholder={textareaPlaceholder}
              className="flex-1 resize-none rounded-2xl border-border/60 bg-background/80 pr-16 text-sm leading-7 placeholder:text-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-70"
              style={{ minHeight: "160px" }}
            />
          </div>
        )}
      </div>

      {/* Viewpoint picker dialog */}
      <ViewpointPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedIds={localState.selectedFragmentIds}
        onConfirm={handleViewpointConfirm}
      />

      {/* Confirm dialog for overwriting */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>生成新版本</AlertDialogTitle>
            <AlertDialogDescription>
              将生成新版本，当前编辑内容将保留在版本{" "}
              {activeVersion?.versionNumber ?? ""} 中，继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmGenerate}>继续</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
