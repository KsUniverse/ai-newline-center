"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { apiClient } from "@/lib/api-client";
import type { PromptTemplateDTO, CreatePromptTemplateInput, UpdatePromptTemplateInput } from "@/types/prompt-template";
import type { AiModelConfigDTO, AiSettingsDTO } from "@/types/ai-config";
import type { PromptStepType } from "@/types/prompt-template";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_TYPES: Array<{ value: PromptStepType; label: string }> = [
  { value: "TRANSCRIPTION", label: "转录" },
  { value: "DECOMPOSITION", label: "拆解" },
  { value: "REWRITE", label: "仿写" },
  { value: "DIRECT_REWRITE", label: "直接创作" },
];

const STEP_VARIABLES: Record<PromptStepType, string[]> = {
  TRANSCRIPTION: ["{{share_url}}"],
  DECOMPOSITION: ["{{transcript_text}}"],
  REWRITE: ["{{framework}}", "{{transcript}}", "{{viewpoints}}", "{{target_account}}", "{{user_input}}"],
  DIRECT_REWRITE: ["{{topic}}", "{{viewpoints}}", "{{target_account}}", "{{user_input}}"],
};

// ─── Form Schema ──────────────────────────────────────────────────────────────

const templateFormSchema = z.object({
  name: z.string().min(1, "请输入模板名称").max(128),
  stepType: z.enum(["TRANSCRIPTION", "DECOMPOSITION", "REWRITE", "DIRECT_REWRITE"] as const),
  content: z.string().min(1, "请输入模板内容"),
  systemContent: z.string().optional(),
  modelConfigId: z.string().optional().nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

// ─── Helper: Step Type Badge ──────────────────────────────────────────────────

function StepTypeBadge({ stepType }: { stepType: PromptStepType }) {
  const item = STEP_TYPES.find((s) => s.value === stepType);
  return (
    <Badge variant="outline" className="text-2xs font-mono tracking-wide">
      {item?.label ?? stepType}
    </Badge>
  );
}

// ─── Variable Hint Panel ──────────────────────────────────────────────────────

interface VariableHintPanelProps {
  stepType: PromptStepType | null;
  onClickVariable: (v: string) => void;
}

function VariableHintPanel({ stepType, onClickVariable }: VariableHintPanelProps) {
  if (!stepType) return null;
  const vars = STEP_VARIABLES[stepType];

  return (
    <div className="rounded-lg border border-border/45 bg-background px-3 py-2.5">
      <p className="mb-2 text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
        可用变量（点击复制）
      </p>
      <div className="flex flex-wrap gap-1.5">
        {vars.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onClickVariable(v)}
            className="rounded-md border border-border/55 bg-card px-2 py-0.5 font-mono text-xs text-primary transition-colors hover:border-primary/40 hover:bg-accent/60"
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Template Form Sheet ──────────────────────────────────────────────────────

interface TemplateSheetProps {
  open: boolean;
  editing: PromptTemplateDTO | null;
  modelConfigs: AiModelConfigDTO[];
  onClose: () => void;
  onSaved: () => void;
}

function TemplateSheet({ open, editing, modelConfigs, onClose, onSaved }: TemplateSheetProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      stepType: "REWRITE",
      content: "",
      systemContent: "",
      modelConfigId: null,
      isDefault: false,
      isActive: true,
    },
  });

  const watchedStepType = watch("stepType");

  useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              stepType: editing.stepType,
              content: editing.content,
              systemContent: editing.systemContent ?? "",
              modelConfigId: editing.modelConfigId ?? null,
              isDefault: editing.isDefault,
              isActive: editing.isActive,
            }
          : {
              name: "",
              stepType: "REWRITE",
              content: "",
              systemContent: "",
              modelConfigId: null,
              isDefault: false,
              isActive: true,
            },
      );
    }
  }, [open, editing, reset]);

  function handleClickVariable(v: string) {
    void navigator.clipboard.writeText(v).then(() => toast.success(`已复制 ${v}`));
  }

  async function onSubmit(values: TemplateFormValues) {
    try {
      if (editing) {
        const payload: UpdatePromptTemplateInput = {
          name: values.name,
          content: values.content,
          systemContent: values.systemContent || null,
          modelConfigId: values.modelConfigId || null,
          isDefault: values.isDefault,
          isActive: values.isActive,
        };
        await apiClient.patch<PromptTemplateDTO>(`/prompt-templates/${editing.id}`, payload);
        toast.success("模板已更新");
      } else {
        const payload: CreatePromptTemplateInput = {
          name: values.name,
          stepType: values.stepType,
          content: values.content,
          systemContent: values.systemContent || null,
          modelConfigId: values.modelConfigId || null,
          isDefault: values.isDefault,
          isActive: values.isActive,
        };
        await apiClient.post<PromptTemplateDTO>("/prompt-templates", payload);
        toast.success("模板已创建");
      }
      void onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败，请稍后重试");
    }
  }

  const fieldClass =
    "h-9 w-full rounded-md border border-border/55 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent side="right" className="w-full max-w-xl overflow-y-auto">
        <SheetHeader className="mb-5">
          <SheetTitle>{editing ? "编辑 Prompt 模板" : "新增 Prompt 模板"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 名称 */}
          <div className="space-y-1.5">
            <label className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
              模板名称 <span className="text-destructive">*</span>
            </label>
            <input
              {...register("name")}
              placeholder="例：仿写主提示词 v1"
              className={fieldClass}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* 步骤类型 */}
          <div className="space-y-1.5">
            <label className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
              步骤类型 <span className="text-destructive">*</span>
            </label>
            {editing ? (
              <div className={`${fieldClass} flex items-center`}>
                <StepTypeBadge stepType={editing.stepType} />
                <span className="ml-2 text-xs text-muted-foreground/60">（编辑时不可修改）</span>
              </div>
            ) : (
              <Controller
                control={control}
                name="stepType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v as PromptStepType)}>
                    <SelectTrigger className="h-9 rounded-md">
                      <SelectValue placeholder="选择步骤类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {STEP_TYPES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
            {errors.stepType && <p className="text-xs text-destructive">{errors.stepType.message}</p>}
          </div>

          {/* 关联模型 */}
          <div className="space-y-1.5">
            <label className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
              关联模型（可选，留空为通用模板）
            </label>
            <Controller
              control={control}
              name="modelConfigId"
              render={({ field }) => (
                <Select
                  value={field.value ?? "__none__"}
                  onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                >
                  <SelectTrigger className="h-9 rounded-md">
                    <SelectValue placeholder="不限模型（通用）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">不限模型（通用）</SelectItem>
                    {modelConfigs.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* 变量提示 */}
          <VariableHintPanel stepType={watchedStepType} onClickVariable={handleClickVariable} />

          {/* 模板内容 */}
          <div className="space-y-1.5">
            <label className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
              用户 Prompt 内容 <span className="text-destructive">*</span>
            </label>
            <textarea
              {...register("content")}
              rows={12}
              placeholder="在此输入 Prompt 模板，使用 {{variable}} 引用变量..."
              className="w-full rounded-md border border-border/55 bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />
            {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
          </div>

          {/* 系统 Prompt（可选） */}
          <div className="space-y-1.5">
            <label className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
              系统 Prompt（可选，留空则使用硬编码默认值）
            </label>
            <textarea
              {...register("systemContent")}
              rows={4}
              placeholder="可选：覆盖 AI 步骤的系统角色设定..."
              className="w-full rounded-md border border-border/55 bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />
          </div>

          {/* 选项 */}
          <div className="flex flex-col gap-3 rounded-lg border border-border/45 bg-background p-3">
            <label className="flex cursor-pointer items-center gap-2.5">
              <Controller
                control={control}
                name="isDefault"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <span className="text-sm text-foreground/80">设为该步骤的默认模板</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5">
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <span className="text-sm text-foreground/80">启用此模板</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

interface DeleteDialogProps {
  template: PromptTemplateDTO | null;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteDialog({ template, onClose, onDeleted }: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!template) return;
    setDeleting(true);
    try {
      await apiClient.del(`/prompt-templates/${template.id}`);
      toast.success("模板已删除");
      void onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={!!template} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除模板</AlertDialogTitle>
          <AlertDialogDescription>
            {template?.isDefault ? (
              <span className="text-destructive font-medium">
                该模板当前为默认模板，请先将其他模板设为默认后再删除。
              </span>
            ) : (
              <>
                即将删除模板「<span className="font-medium text-foreground">{template?.name}</span>」，此操作不可撤销。
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>取消</AlertDialogCancel>
          {!template?.isDefault && (
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Template Table ───────────────────────────────────────────────────────────

interface TemplateTableProps {
  templates: PromptTemplateDTO[];
  onEdit: (t: PromptTemplateDTO) => void;
  onDelete: (t: PromptTemplateDTO) => void;
  onSetDefault: (t: PromptTemplateDTO) => void;
  settingDefaultId: string | null;
}

function TemplateTable({ templates, onEdit, onDelete, onSetDefault, settingDefaultId }: TemplateTableProps) {
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/45 bg-background py-16 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground/60">暂无模板，点击「新增模板」创建</p>
      </div>
    );
  }

  return (
    <div className="hidden overflow-hidden rounded-xl border border-border/55 bg-background md:block">
      <Table>
        <TableHeader>
          <TableRow className="border-border/45 hover:bg-transparent">
            <TableHead className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
              名称
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
              关联模型
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
              状态
            </TableHead>
            <TableHead className="w-40 text-right text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
              操作
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((t) => (
            <TableRow key={t.id} className="border-border/35 hover:bg-accent/30">
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground/90">{t.name}</span>
                  {t.isDefault && (
                    <Badge className="h-5 gap-1 px-1.5 text-2xs bg-primary/10 text-primary border-primary/20">
                      <Star className="h-2.5 w-2.5" />
                      默认
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground/80">
                  {t.modelConfigName ?? "通用"}
                </span>
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs ${
                    t.isActive ? "text-green-600 dark:text-green-400" : "text-muted-foreground/50"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      t.isActive ? "bg-green-500" : "bg-muted-foreground/30"
                    }`}
                  />
                  {t.isActive ? "启用" : "停用"}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {!t.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-primary"
                      onClick={() => onSetDefault(t)}
                      disabled={settingDefaultId === t.id}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {settingDefaultId === t.id ? "设置中..." : "设为默认"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => onEdit(t)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(t)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Mobile Card List ─────────────────────────────────────────────────────────

interface MobileCardListProps {
  templates: PromptTemplateDTO[];
  onEdit: (t: PromptTemplateDTO) => void;
  onDelete: (t: PromptTemplateDTO) => void;
  onSetDefault: (t: PromptTemplateDTO) => void;
  settingDefaultId: string | null;
}

function MobileCardList({ templates, onEdit, onDelete, onSetDefault, settingDefaultId }: MobileCardListProps) {
  if (templates.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 md:hidden">
      {templates.map((t) => (
        <div
          key={t.id}
          className="rounded-xl border border-border/45 bg-background p-4"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-foreground/90">{t.name}</span>
                {t.isDefault && (
                  <Badge className="h-5 gap-1 px-1.5 text-2xs bg-primary/10 text-primary border-primary/20">
                    <Star className="h-2.5 w-2.5" />
                    默认
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground/60">
                {t.modelConfigName ? `关联模型：${t.modelConfigName}` : "通用模板"}
              </p>
            </div>
            <span
              className={`mt-0.5 inline-flex items-center gap-1 text-xs shrink-0 ${
                t.isActive ? "text-green-600 dark:text-green-400" : "text-muted-foreground/50"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  t.isActive ? "bg-green-500" : "bg-muted-foreground/30"
                }`}
              />
              {t.isActive ? "启用" : "停用"}
            </span>
          </div>
          <div className="flex items-center gap-1 pt-2 border-t border-border/35">
            {!t.isDefault && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-primary"
                onClick={() => onSetDefault(t)}
                disabled={settingDefaultId === t.id}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                设为默认
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(t)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(t)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export function PromptTemplateListPage() {
  const [templates, setTemplates] = useState<PromptTemplateDTO[]>([]);
  const [modelConfigs, setModelConfigs] = useState<AiModelConfigDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PromptStepType | "ALL">("ALL");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplateDTO | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<PromptTemplateDTO | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [templateList, aiSettings] = await Promise.all([
        apiClient.get<PromptTemplateDTO[]>("/prompt-templates"),
        apiClient.get<AiSettingsDTO>("/ai-config/settings"),
      ]);
      setTemplates(templateList);
      setModelConfigs(aiSettings.modelConfigs);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSetDefault(t: PromptTemplateDTO) {
    setSettingDefaultId(t.id);
    try {
      await apiClient.post(`/prompt-templates/${t.id}/set-default`);
      toast.success(`已将「${t.name}」设为默认`);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSettingDefaultId(null);
    }
  }

  function handleEdit(t: PromptTemplateDTO) {
    setEditingTemplate(t);
    setSheetOpen(true);
  }

  function handleCloseSheet() {
    setSheetOpen(false);
    setEditingTemplate(null);
  }

  async function handleSaved() {
    handleCloseSheet();
    await loadData();
  }

  async function handleDeleted() {
    setDeletingTemplate(null);
    await loadData();
  }

  const filteredTemplates =
    activeTab === "ALL"
      ? templates
      : templates.filter((t) => t.stepType === activeTab);

  const tabs: Array<{ key: PromptStepType | "ALL"; label: string; count: number }> = [
    { key: "ALL", label: "全部", count: templates.length },
    ...STEP_TYPES.map((s) => ({
      key: s.value,
      label: s.label,
      count: templates.filter((t) => t.stepType === s.value).length,
    })),
  ];

  return (
    <DashboardPageShell
      eyebrow="System Settings"
      title="Prompt 模板"
      description="管理 AI 各步骤的 Prompt 模板，设置默认模板后将在 AI 调用时自动使用。"
      actions={
        <Button
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs"
          onClick={() => { setEditingTemplate(null); setSheetOpen(true); }}
        >
          <Plus className="h-3.5 w-3.5" />
          新增模板
        </Button>
      }
    >
      {/* Step Type Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "border border-border/55 bg-background text-muted-foreground hover:border-primary/30 hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            {tab.label}
            <span
              className={`inline-flex h-4 min-w-[1rem] items-center justify-center rounded-sm px-1 text-2xs font-mono ${
                activeTab === tab.key
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground/70"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground/60">加载中...</p>
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : (
        <>
          <TemplateTable
            templates={filteredTemplates}
            onEdit={handleEdit}
            onDelete={setDeletingTemplate}
            onSetDefault={handleSetDefault}
            settingDefaultId={settingDefaultId}
          />
          <MobileCardList
            templates={filteredTemplates}
            onEdit={handleEdit}
            onDelete={setDeletingTemplate}
            onSetDefault={handleSetDefault}
            settingDefaultId={settingDefaultId}
          />
        </>
      )}

      {/* Sheet */}
      <TemplateSheet
        open={sheetOpen}
        editing={editingTemplate}
        modelConfigs={modelConfigs}
        onClose={handleCloseSheet}
        onSaved={handleSaved}
      />

      {/* Delete Dialog */}
      <DeleteDialog
        template={deletingTemplate}
        onClose={() => setDeletingTemplate(null)}
        onDeleted={handleDeleted}
      />
    </DashboardPageShell>
  );
}
