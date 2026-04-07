"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Cpu,
  Database,
  Pencil,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { SurfaceSection } from "@/components/shared/common/surface-section";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";

import { managementClient } from "@/lib/management-client";
import type {
  AiModelConfigDTO,
  AiSettingsDTO,
  AiStep,
  AiVideoInputMode,
  CreateAiModelConfigInput,
  UpdateAiModelConfigInput,
} from "@/types/ai-config";

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS: Array<{ step: AiStep; label: string; description: string }> = [
  { step: "TRANSCRIBE", label: "转录", description: "负责将本地视频转为文字稿，需选择支持视频输入的模型。" },
  { step: "DECOMPOSE", label: "拆解", description: "对转录稿进行结构化理解，输出功能点标注。" },
  { step: "REWRITE", label: "仿写", description: "基于拆解结果生成仿写草稿。" },
];

const VIDEO_INPUT_MODE_LABELS: Record<AiVideoInputMode, string> = {
  NONE: "纯文本",
  DASHSCOPE_FILE: "DashScope 文件上传（千问 VL 系列）",
  GOOGLE_FILE: "视频文件（Google AI Studio）",
};

// ─── Form schema ─────────────────────────────────────────────────────────────

const modelConfigFormSchema = z.object({
  name: z.string().min(1, "请输入名称").max(64),
  baseUrl: z.string().url("请输入有效的 API 地址"),
  apiKey: z.string().optional(),
  modelName: z.string().min(1, "请输入模型名称").max(128),
  videoInputMode: z.enum(["NONE", "DASHSCOPE_FILE", "GOOGLE_FILE"] as const),
});

type ModelConfigFormValues = z.infer<typeof modelConfigFormSchema>;

// ─── Model Config Dialog ──────────────────────────────────────────────────────

interface ModelConfigDialogProps {
  open: boolean;
  editing: AiModelConfigDTO | null;
  onClose: () => void;
  onSaved: (config: AiModelConfigDTO) => void;
}

function ModelConfigDialog({ open, editing, onClose, onSaved }: ModelConfigDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ModelConfigFormValues>({
    resolver: zodResolver(modelConfigFormSchema),
    defaultValues: {
      name: "",
      baseUrl: "",
      apiKey: "",
      modelName: "",
      videoInputMode: "NONE",
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              baseUrl: editing.baseUrl,
              apiKey: "",
              modelName: editing.modelName,
              videoInputMode: editing.videoInputMode,
            }
          : { name: "", baseUrl: "", apiKey: "", modelName: "", videoInputMode: "NONE" },
      );
    }
  }, [open, editing, reset]);

  const videoInputMode = watch("videoInputMode");

  async function onSubmit(values: ModelConfigFormValues) {
    try {
      let result: AiModelConfigDTO;
      if (editing) {
        const payload: UpdateAiModelConfigInput = {
          name: values.name,
          baseUrl: values.baseUrl,
          modelName: values.modelName,
          videoInputMode: values.videoInputMode,
          ...(values.apiKey ? { apiKey: values.apiKey } : {}),
        };
        result = await managementClient.updateAiModelConfig(editing.id, payload);
      } else {
        const payload: CreateAiModelConfigInput = {
          name: values.name,
          baseUrl: values.baseUrl,
          apiKey: values.apiKey ?? "",
          modelName: values.modelName,
          videoInputMode: values.videoInputMode,
        };
        result = await managementClient.createAiModelConfig(payload);
      }
      toast.success(editing ? "模型配置已更新" : "模型配置已创建");
      onSaved(result);
    } catch {
      toast.error(editing ? "更新失败" : "创建失败");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑模型配置" : "新增模型配置"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">名称</label>
            <input
              {...register("name")}
              placeholder="例：DashScope qwen-vl-max"
              className="h-9 w-full rounded-md border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">API 地址 (baseUrl)</label>
            <input
              {...register("baseUrl")}
              placeholder="例：https://dashscope.aliyuncs.com/compatible-mode/v1"
              className="h-9 w-full rounded-md border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {errors.baseUrl && <p className="text-xs text-destructive">{errors.baseUrl.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
              API Key{editing ? "（留空则保留原有密钥）" : ""}
            </label>
            <input
              {...register("apiKey")}
              type="password"
              placeholder={editing ? "留空保持不变" : "sk-..."}
              className="h-9 w-full rounded-md border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">模型名称</label>
            <input
              {...register("modelName")}
              placeholder="例：qwen-vl-max-latest"
              className="h-9 w-full rounded-md border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {errors.modelName && <p className="text-xs text-destructive">{errors.modelName.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">视频输入方式</label>
            <Select
              value={videoInputMode}
              onValueChange={(v) => setValue("videoInputMode", v as AiVideoInputMode)}
            >
              <SelectTrigger className="h-9 rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["NONE", "DASHSCOPE_FILE", "GOOGLE_FILE"] as AiVideoInputMode[]).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {VIDEO_INPUT_MODE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-muted-foreground/70">
              {videoInputMode === "DASHSCOPE_FILE" && "将视频上传到 DashScope 临时 OSS，以 oss:// URL 传入千问 VL 模型。"}
              {videoInputMode === "GOOGLE_FILE" && "将视频文件上传到 Google Files API，适用于 Google AI Studio 模型。"}
              {videoInputMode === "NONE" && "仅支持文字输入（DECOMPOSE / REWRITE），不可用于转录步骤。"}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>取消</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AiConfigPageView() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const redirected = useRef(false);

  const [settings, setSettings] = useState<AiSettingsDTO | null>(null);
  const [bindings, setBindings] = useState<Record<AiStep, string | null>>({
    TRANSCRIBE: null, DECOMPOSE: null, REWRITE: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localDraft, setLocalDraft] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AiModelConfigDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "SUPER_ADMIN" && !redirected.current) {
      redirected.current = true;
      router.replace("/dashboard");
    }
  }, [router, session, status]);

  useEffect(() => {
    if (status !== "authenticated" || session?.user?.role !== "SUPER_ADMIN") return;
    let cancelled = false;

    async function loadConfig() {
      setLoading(true);
      try {
        const data = await managementClient.getAiConfig();
        if (!cancelled) {
          setSettings(data);
          const bindingMap: Record<AiStep, string | null> = { TRANSCRIBE: null, DECOMPOSE: null, REWRITE: null };
          for (const b of data.bindings) bindingMap[b.step] = b.modelConfigId;
          setBindings(bindingMap);
          setLocalDraft(false);
          setLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "AI 配置加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadConfig();
    return () => { cancelled = true; };
  }, [reloadKey, session?.user?.role, status]);

  if (status === "loading" || (status === "authenticated" && session?.user?.role !== "SUPER_ADMIN")) {
    return null;
  }

  if (loadError) {
    return (
      <DashboardPageShell eyebrow="System Settings" title="AI 配置" description="配置加载失败" maxWidth="wide"
        actions={<Button size="sm" className="h-8 rounded-md px-3 text-sm" onClick={() => setReloadKey((k) => k + 1)}>重新加载</Button>}
      >
        <SurfaceSection eyebrow="Error" title="AI 配置暂不可用" description={loadError}>
          <div />
        </SurfaceSection>
      </DashboardPageShell>
    );
  }

  const modelConfigs = settings?.modelConfigs ?? [];
  const configMap = new Map(modelConfigs.map((c) => [c.id, c]));

  async function handleSaveBindings() {
    setSaving(true);
    try {
      const data = await managementClient.updateAiConfig({
        bindings: STEPS.map(({ step }) => ({ step, modelConfigId: bindings[step] })),
      });
      setSettings(data);
      setLocalDraft(false);
      toast.success("步骤绑定已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }

  function handleConfigSaved(config: AiModelConfigDTO) {
    setSettings((prev) => {
      if (!prev) return prev;
      const exists = prev.modelConfigs.some((c) => c.id === config.id);
      return {
        ...prev,
        modelConfigs: exists
          ? prev.modelConfigs.map((c) => (c.id === config.id ? config : c))
          : [...prev.modelConfigs, config],
      };
    });
    setDialogOpen(false);
    setEditingConfig(null);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await managementClient.deleteAiModelConfig(id);
      setSettings((prev) =>
        prev ? { ...prev, modelConfigs: prev.modelConfigs.filter((c) => c.id !== id) } : prev,
      );
      // Clear bindings that referenced this config
      setBindings((prev) => {
        const next = { ...prev };
        for (const step of Object.keys(next) as AiStep[]) {
          if (next[step] === id) next[step] = null;
        }
        return next;
      });
      toast.success("模型配置已删除");
    } catch {
      toast.error("删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <DashboardPageShell
      eyebrow="System Settings"
      title="AI 配置"
      description="管理模型配置池，并为转录、拆解、仿写三个步骤绑定对应模型。"
      maxWidth="wide"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">

        {/* 模型配置池 */}
        <div className="animate-in-up-d1 min-w-0">
          <SurfaceSection
            eyebrow="Model Pool"
            title="模型配置池"
            description="配置任意 OpenAI 兼容 API 或 Google AI 模型，支持视频帧输入（DashScope VL）和文件上传（Google AI Studio）。"
            actions={
              <MetaPillList items={[
                { label: `${modelConfigs.length} 个模型`, icon: Database, tone: "primary" },
                { label: `${modelConfigs.filter((c) => c.videoInputMode !== "NONE").length} 支持视频`, icon: Video },
              ]} />
            }
            bodyClassName="space-y-3"
          >
            {!loading && modelConfigs.length === 0 && (
              <div className="rounded-3xl border border-dashed border-border/60 bg-background/50 px-4 py-6 text-center text-sm text-muted-foreground/70">
                暂无模型配置，点击"新增"开始添加
              </div>
            )}

            {modelConfigs.map((config) => (
              <article key={config.id} className="rounded-3xl border border-border/60 bg-background/75 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <h3 className="truncate text-sm font-semibold tracking-tight text-foreground/95">{config.name}</h3>
                    <p className="truncate text-xs text-muted-foreground/70">{config.modelName}</p>
                    <p className="truncate text-xs text-muted-foreground/50">{config.baseUrl}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant="secondary" className="text-2xs">
                      {VIDEO_INPUT_MODE_LABELS[config.videoInputMode]}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => { setEditingConfig(config); setDialogOpen(true); }}
                      className="rounded-full p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === config.id}
                      onClick={() => void handleDelete(config.id)}
                      className="rounded-full p-1.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground/50">Key: {config.apiKeyMasked}</p>
              </article>
            ))}

            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-2xl"
              disabled={loading}
              onClick={() => { setEditingConfig(null); setDialogOpen(true); }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              新增模型配置
            </Button>
          </SurfaceSection>
        </div>

        {/* 步骤绑定 */}
        <div className="animate-in-up-d2 min-w-0">
          <SurfaceSection
            eyebrow="Step Binding"
            title="步骤绑定"
            description="为转录、拆解、仿写三个步骤各选择一个模型配置。"
            actions={
              <MetaPillList items={[
                { label: localDraft ? "本地草稿" : "远端同步", icon: CheckCircle2, tone: localDraft ? "default" : "success" },
                { label: `${modelConfigs.length} 个可选`, icon: Cpu, tone: "primary" },
              ]} />
            }
            bodyClassName="space-y-4"
          >
            {STEPS.map(({ step, label, description }) => {
              const selectedId = bindings[step];
              const selectedConfig = selectedId ? configMap.get(selectedId) : null;
              const compatibleModels = step === "TRANSCRIBE"
                ? modelConfigs.filter((c) => c.videoInputMode !== "NONE")
                : modelConfigs;

              return (
                <div key={step} className="rounded-3xl border border-border/60 bg-background/75 p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">{label}</p>
                      <p className="text-xs leading-5 text-muted-foreground/70">{description}</p>
                    </div>
                    <Badge variant={selectedConfig ? "default" : "secondary"} className="text-xs">
                      {selectedConfig?.name ?? "未绑定"}
                    </Badge>
                  </div>

                  <div className="mt-3">
                    <Select
                      value={selectedId ?? ""}
                      onValueChange={(v) => {
                        setBindings((prev) => ({ ...prev, [step]: v || null }));
                        setLocalDraft(true);
                      }}
                    >
                      <SelectTrigger className="h-9 rounded-md">
                        <SelectValue placeholder="选择模型配置" />
                      </SelectTrigger>
                      <SelectContent>
                        {compatibleModels.length === 0 && (
                          <SelectItem value="__empty__" disabled>
                            {step === "TRANSCRIBE" ? "暂无支持视频的模型" : "暂无模型配置"}
                          </SelectItem>
                        )}
                        {compatibleModels.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} — {c.modelName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedConfig && (
                    <p className="mt-2 text-xs text-muted-foreground/60">
                      {VIDEO_INPUT_MODE_LABELS[selectedConfig.videoInputMode]} · {selectedConfig.baseUrl}
                    </p>
                  )}
                </div>
              );
            })}

            <Button
              size="sm"
              className="h-8 w-full rounded-md px-3 text-sm"
              disabled={saving || loading || !localDraft}
              onClick={() => void handleSaveBindings()}
            >
              {saving ? "保存中..." : "保存绑定"}
            </Button>
          </SurfaceSection>
        </div>
      </div>

      <ModelConfigDialog
        open={dialogOpen}
        editing={editingConfig}
        onClose={() => { setDialogOpen(false); setEditingConfig(null); }}
        onSaved={handleConfigSaved}
      />
    </DashboardPageShell>
  );
}

export const AiConfigPage = AiConfigPageView;

