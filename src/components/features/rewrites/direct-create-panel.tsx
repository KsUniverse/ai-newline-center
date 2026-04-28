"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, PenLine, Plus, X } from "lucide-react";

import type { AiModelConfigDTO } from "@/types/ai-config";
import type { DirectGenerateRewriteInput, RewriteDTO } from "@/types/ai-workspace";
import type { DouyinAccountDTO } from "@/types/douyin-account";
import type { FragmentDTO } from "@/types/fragment";
import type { DirectCreateLocalState } from "@/lib/hooks/use-direct-create-local-state";
import {
  BRAND_FORM_SECTION_CLASS_NAME,
  BRAND_INSET_SURFACE_CLASS_NAME,
  BRAND_SURFACE_CLASS_NAME,
} from "@/components/shared/common/brand";
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

import { ViewpointPicker } from "../benchmarks/viewpoint-picker";

interface DirectCreatePanelProps {
  localState: DirectCreateLocalState;
  selectedFragments: FragmentDTO[];
  accounts: DouyinAccountDTO[];
  modelConfigs: AiModelConfigDTO[];
  rewrite: RewriteDTO | null;
  activeVersionId: string | null;
  loadingAccounts: boolean;
  loadingSettings: boolean;
  generating: boolean;
  onSetFragmentIds: (ids: string[]) => void;
  onSetSelectedFragments: (fragments: FragmentDTO[]) => void;
  onSetUserInputContent: (value: string) => void;
  onSetTopic: (value: string) => void;
  onSetTargetAccountId: (value: string | null) => void;
  onSetModelConfigId: (value: string | null) => void;
  onSetActiveVersionId: (id: string) => void;
  onGenerate: (input: DirectGenerateRewriteInput) => void;
  onSaveVersionEdit: (versionId: string, content: string) => void;
  onNewTask: () => void;
  onSetFinalVersion: (versionId: string) => void;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const DirectCreatePanel = memo(function DirectCreatePanel({
  localState,
  selectedFragments,
  accounts,
  modelConfigs,
  rewrite,
  activeVersionId,
  loadingAccounts,
  loadingSettings,
  generating,
  onSetFragmentIds,
  onSetSelectedFragments,
  onSetUserInputContent,
  onSetTopic,
  onSetTargetAccountId,
  onSetModelConfigId,
  onSetActiveVersionId,
  onGenerate,
  onSaveVersionEdit,
  onNewTask,
  onSetFinalVersion,
}: DirectCreatePanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingInput, setPendingInput] = useState<DirectGenerateRewriteInput | null>(null);
  const [editContent, setEditContent] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeVersion = useMemo(
    () => rewrite?.versions.find((version) => version.id === activeVersionId) ?? null,
    [activeVersionId, rewrite?.versions],
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
      if (!activeVersionId || activeVersion?.status !== "COMPLETED") {
        return;
      }

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onSaveVersionEdit(activeVersionId, value);
      }, 1000);
    },
    [activeVersion?.status, activeVersionId, onSaveVersionEdit],
  );

  const handleViewpointConfirm = useCallback(
    (ids: string[], fragments: FragmentDTO[]) => {
      onSetFragmentIds(ids);
      onSetSelectedFragments(fragments);
    },
    [onSetFragmentIds, onSetSelectedFragments],
  );

  const handleRemoveFragment = useCallback(
    (id: string) => {
      onSetFragmentIds(localState.fragmentIds.filter((fragmentId) => fragmentId !== id));
      onSetSelectedFragments(selectedFragments.filter((fragment) => fragment.id !== id));
    },
    [localState.fragmentIds, onSetFragmentIds, onSetSelectedFragments, selectedFragments],
  );

  const buildGenerateInput = useCallback((): DirectGenerateRewriteInput | null => {
    if (!localState.targetAccountId || !localState.modelConfigId || !localState.topic.trim()) {
      return null;
    }

    return {
      rewriteId: localState.currentRewriteId ?? undefined,
      targetAccountId: localState.targetAccountId,
      modelConfigId: localState.modelConfigId,
      usedFragmentIds: localState.fragmentIds,
      userInputContent: localState.userInputContent.trim() || undefined,
      topic: localState.topic.trim(),
    };
  }, [localState]);

  const handleGenerateClick = useCallback(() => {
    const input = buildGenerateInput();
    if (!input) {
      return;
    }

    if (activeVersion?.editedContent) {
      setPendingInput(input);
      setConfirmDialogOpen(true);
      return;
    }

    onGenerate(input);
  }, [activeVersion?.editedContent, buildGenerateInput, onGenerate]);

  const handleConfirmGenerate = useCallback(() => {
    setConfirmDialogOpen(false);
    if (pendingInput) {
      onGenerate(pendingInput);
      setPendingInput(null);
    }
  }, [onGenerate, pendingInput]);

  const hasGeneratingVersion =
    rewrite?.versions.some((version) => version.status === "GENERATING") ?? false;
  const inputDisabled = generating || hasGeneratingVersion;
  const generateDisabled =
    inputDisabled ||
    loadingAccounts ||
    loadingSettings ||
    !localState.topic.trim() ||
    !localState.targetAccountId ||
    !localState.modelConfigId;

  const displayedFragments = selectedFragments.slice(0, 6);

  let textareaPlaceholder = "选择素材并填写主题后，点击「创作」生成文案";
  if (generating || activeVersion?.status === "GENERATING") {
    textareaPlaceholder = "AI 正在创作...";
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <section className={`${BRAND_SURFACE_CLASS_NAME} p-4 sm:p-5`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">
              Input
            </p>
            <h2 className="text-lg font-semibold text-foreground/90">创作输入</h2>
          </div>
          <Badge className="rounded-md border border-border/45 bg-background px-2.5 py-1 text-xs text-muted-foreground">
            {localState.fragmentIds.length} 条观点
          </Badge>
        </div>

        <div className="grid gap-4">
          <div className={BRAND_FORM_SECTION_CLASS_NAME}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm font-medium">今日观点</Label>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  可选择多条观点作为本次创作素材
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={inputDisabled}
                onClick={() => setPickerOpen(true)}
                className="h-8 rounded-md"
              >
                选择
              </Button>
            </div>

            {localState.fragmentIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {displayedFragments.map((fragment) => (
                  <span
                    key={fragment.id}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/45 bg-card px-2.5 py-1 text-xs text-foreground/90"
                  >
                    <span className="max-w-52 truncate">{fragment.content}</span>
                    <button
                      type="button"
                      disabled={inputDisabled}
                      onClick={() => handleRemoveFragment(fragment.id)}
                      className="rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                      aria-label="移除观点"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
                {localState.fragmentIds.length > displayedFragments.length ? (
                  <span className="inline-flex items-center rounded-md border border-border/45 bg-card px-2.5 py-1 text-xs text-muted-foreground">
                    +{localState.fragmentIds.length - displayedFragments.length}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className={`${BRAND_INSET_SURFACE_CLASS_NAME} px-3 py-3 text-sm text-muted-foreground/70`}>
                尚未选择观点
              </div>
            )}
          </div>

          <div className={BRAND_FORM_SECTION_CLASS_NAME}>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-medium">创作主题/指令</Label>
              <Badge variant="secondary" className="rounded-md border border-border/45 px-2 py-0.5 text-xs">
                {localState.topic.length}/500
              </Badge>
            </div>
            <Textarea
              value={localState.topic}
              disabled={inputDisabled}
              maxLength={500}
              onChange={(event) => onSetTopic(event.target.value)}
              placeholder="例如：围绕今天盘面分化，写一条提醒普通投资者控制节奏的短视频文案"
              className="min-h-28 resize-none rounded-lg border-border/55 bg-card text-sm leading-7"
            />
          </div>

          <div className={BRAND_FORM_SECTION_CLASS_NAME}>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-medium">临时素材</Label>
              <Badge variant="secondary" className="rounded-md border border-border/45 px-2 py-0.5 text-xs">
                {localState.userInputContent.length}/2000
              </Badge>
            </div>
            <Textarea
              value={localState.userInputContent}
              disabled={inputDisabled}
              maxLength={2000}
              onChange={(event) => onSetUserInputContent(event.target.value)}
              placeholder="补充金句、案例、数据或表达偏好"
              className="min-h-32 resize-none rounded-lg border-border/55 bg-card text-sm leading-7"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className={BRAND_FORM_SECTION_CLASS_NAME}>
              <Label className="text-sm font-medium">目标账号</Label>
              {loadingAccounts ? (
                <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  加载中
                </div>
              ) : accounts.length === 0 ? (
                <p className="text-xs leading-5 text-muted-foreground/70">请先添加我的账号</p>
              ) : (
                <Select
                  disabled={inputDisabled}
                  value={localState.targetAccountId ?? ""}
                  onValueChange={(value) => onSetTargetAccountId(value || null)}
                >
                  <SelectTrigger className="h-9 rounded-lg border-border/55 bg-card text-sm">
                    <SelectValue placeholder="选择账号" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/55 bg-card">
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id} className="rounded-lg text-sm">
                        {account.nickname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className={BRAND_FORM_SECTION_CLASS_NAME}>
              <Label className="text-sm font-medium">AI 模型</Label>
              {loadingSettings ? (
                <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  加载中
                </div>
              ) : modelConfigs.length === 0 ? (
                <p className="text-xs leading-5 text-muted-foreground/70">请联系管理员配置模型</p>
              ) : (
                <Select
                  disabled={inputDisabled}
                  value={localState.modelConfigId ?? ""}
                  onValueChange={(value) => onSetModelConfigId(value || null)}
                >
                  <SelectTrigger className="h-9 rounded-lg border-border/55 bg-card text-sm">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/55 bg-card">
                    {modelConfigs.map((config) => (
                      <SelectItem key={config.id} value={config.id} className="rounded-lg text-sm">
                        {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <Button
            type="button"
            disabled={generateDisabled}
            onClick={handleGenerateClick}
            className="h-10 w-full rounded-md"
          >
            {inputDisabled ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                创作中
              </>
            ) : (
              <>
                <PenLine className="mr-2 h-4 w-4" />
                创作
              </>
            )}
          </Button>
        </div>
      </section>

      <section className={`${BRAND_SURFACE_CLASS_NAME} flex min-h-140 flex-col p-4 sm:p-5`}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">
              Output
            </p>
            <h2 className="text-lg font-semibold text-foreground/90">生成结果</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={inputDisabled}
              onClick={onNewTask}
              className="h-8 rounded-md"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              新建任务
            </Button>
          {rewrite && rewrite.versions.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border/45 bg-background px-3 text-sm text-foreground transition-colors hover:bg-accent/55"
                >
                  {activeVersion ? `版本 ${activeVersion.versionNumber}` : "选择版本"}
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-60 rounded-xl border-border/55 bg-card p-1">
                {rewrite.versions.map((version) => (
                  <DropdownMenuItem
                    key={version.id}
                    onClick={() => onSetActiveVersionId(version.id)}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${activeVersionId === version.id ? "bg-primary/10 text-primary" : ""}`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">版本 {version.versionNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(version.createdAt)}
                        {version.modelConfig ? ` · ${version.modelConfig.name}` : ""}
                      </span>
                    </div>
                    {version.isFinalVersion ? (
                      <Badge variant="outline" className="shrink-0 border-green-600/20 bg-green-600/10 text-green-700 dark:border-green-400/20 dark:bg-green-400/10 dark:text-green-400 text-xs">
                        最终稿
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 shrink-0 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetFinalVersion(version.id);
                        }}
                      >
                        设最终稿
                      </Button>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Badge variant="secondary" className="rounded-md border border-border/45 bg-background px-2.5 py-1 text-xs">
              暂无版本
            </Badge>
          )}
          </div>
        </div>

        {activeVersion?.status === "FAILED" ? (
          <div className="flex flex-1 flex-col rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <span className="font-medium">生成失败</span>
            <span className="mt-1 text-xs leading-5 text-destructive/80">
              {activeVersion.errorMessage ?? "请调整输入后重新创作"}
            </span>
          </div>
        ) : (
          <Textarea
            value={editContent}
            onChange={(event) => handleEditChange(event.target.value)}
            disabled={generating || activeVersion?.status === "GENERATING"}
            placeholder={textareaPlaceholder}
            className="min-h-120 flex-1 resize-none rounded-lg border-border/55 bg-background text-sm leading-7"
          />
        )}
      </section>

      <ViewpointPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedIds={localState.fragmentIds}
        onConfirm={handleViewpointConfirm}
      />

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>继续创作新版本</AlertDialogTitle>
            <AlertDialogDescription>
              当前编辑内容会保留在原版本中，系统将为同一任务追加一个新版本。
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
