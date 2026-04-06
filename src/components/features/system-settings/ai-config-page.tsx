"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Cpu, HardDriveDownload, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { SurfaceSection } from "@/components/shared/common/surface-section";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { toast } from "sonner";

import { managementClient } from "@/lib/management-client";

type AiStep = "TRANSCRIBE" | "DECOMPOSE" | "REWRITE";

interface AiImplementation {
  key: string;
  name: string;
  provider: string;
  steps: AiStep[];
  available: boolean;
  requiredEnvKeys: string[];
}

interface RemoteAiConfig {
  steps: Array<{
    step: AiStep;
    implementationKey: string | null;
  }>;
}

const STEPS: Array<{ step: AiStep; label: string; description: string }> = [
  { step: "TRANSCRIBE", label: "转录", description: "固定 Prompt + 链接输入，优先保证主文档生成稳定。" },
  { step: "DECOMPOSE", label: "拆解", description: "围绕语义段做结构化解释，后续沉淀样本。" },
  { step: "REWRITE", label: "仿写", description: "当前交给工作台草稿编辑，先保留人工主导。" },
];

const IMPLEMENTATIONS: AiImplementation[] = [
  {
    key: "openai-transcribe",
    name: "OpenAI 转录",
    provider: "OpenAI",
    steps: ["TRANSCRIBE"],
    available: true,
    requiredEnvKeys: ["OPENAI_API_KEY"],
  },
  {
    key: "deepseek-decompose",
    name: "DeepSeek 拆解",
    provider: "DeepSeek",
    steps: ["DECOMPOSE"],
    available: false,
    requiredEnvKeys: ["DEEPSEEK_API_KEY"],
  },
  {
    key: "qwen-rewrite",
    name: "Qwen 仿写",
    provider: "DashScope",
    steps: ["REWRITE"],
    available: false,
    requiredEnvKeys: ["DASHSCOPE_API_KEY"],
  },
  {
    key: "manual-edit",
    name: "人工编辑",
    provider: "Local",
    steps: ["DECOMPOSE", "REWRITE"],
    available: true,
    requiredEnvKeys: [],
  },
];

function getDefaultBindings(): Record<AiStep, string | null> {
  return {
    TRANSCRIBE: "openai-transcribe",
    DECOMPOSE: "deepseek-decompose",
    REWRITE: "manual-edit",
  };
}

function mapRemoteConfig(config: RemoteAiConfig): Record<AiStep, string | null> {
  const bindings = getDefaultBindings();

  for (const item of config.steps) {
    bindings[item.step] = item.implementationKey;
  }

  return bindings;
}

export function AiConfigPageView() {
  const [bindings, setBindings] = useState<Record<AiStep, string | null>>(getDefaultBindings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localDraft, setLocalDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const implementationMap = useMemo(
    () => new Map(IMPLEMENTATIONS.map((implementation) => [implementation.key, implementation] as const)),
    [],
  );
  const availableCount = IMPLEMENTATIONS.filter((implementation) => implementation.available).length;

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const config = await managementClient.getAiConfig();
        if (!cancelled) {
          setBindings(mapRemoteConfig(config));
          setLocalDraft(false);
        }
      } catch {
        if (!cancelled) {
          setBindings(getDefaultBindings());
          setLocalDraft(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await managementClient.updateAiConfig({
        bindings: STEPS.map((step) => ({
          step: step.step,
          implementationKey: bindings[step.step],
        })),
      });
      setLocalDraft(false);
      setLastSavedAt(new Date().toISOString());
      toast.success("AI 配置已保存");
    } catch {
      setLocalDraft(true);
      setLastSavedAt(new Date().toISOString());
      toast.warning("后端接口未就绪，当前配置已先保留在前端草稿中");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardPageShell
      eyebrow="System Settings"
      title="AI 配置"
      description="为转录、拆解、仿写三个步骤选择当前默认实现。页面先保持统一的工作台语言，后端接口就绪后可直接接上。"
      maxWidth="wide"
      actions={
        <Button size="sm" className="h-8 rounded-md px-3 text-sm" disabled={saving || loading} onClick={() => void handleSave()}>
          {saving ? "保存中..." : "保存绑定"}
        </Button>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="animate-in-up-d1 min-w-0">
          <SurfaceSection
            eyebrow="Step Binding"
            title="步骤绑定"
            description="分别为转录、拆解、仿写三个步骤选择当前默认实现，保持系统行为可解释、可替换。"
            actions={
              <MetaPillList
                items={[
                  { label: localDraft ? "前端草稿" : "远端同步", icon: localDraft ? Sparkles : CheckCircle2, tone: localDraft ? "default" : "success" },
                  { label: `${availableCount} 个实现可用`, icon: Cpu, tone: "primary" },
                ]}
              />
            }
            bodyClassName="space-y-5"
          >
            <div className="grid gap-4">
              {STEPS.map((step) => {
                const selectedKey = bindings[step.step];
                const selectedImplementation = selectedKey ? implementationMap.get(selectedKey) : null;

                return (
                  <div key={step.step} className="rounded-3xl border border-border/60 bg-background/75 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">{step.label}</p>
                        <p className="text-sm leading-6 text-muted-foreground/80">{step.description}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {selectedImplementation?.name ?? "未选择"}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="space-y-1.5">
                        <label className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">绑定实现</label>
                        <Select
                          value={selectedKey ?? ""}
                          onValueChange={(value) => {
                            setBindings((current) => ({
                              ...current,
                              [step.step]: value || null,
                            }));
                            setLocalDraft(true);
                          }}
                        >
                          <SelectTrigger className="h-9 rounded-md">
                            <SelectValue placeholder="选择实现" />
                          </SelectTrigger>
                          <SelectContent>
                            {IMPLEMENTATIONS.filter((implementation) => implementation.steps.includes(step.step)).map((implementation) => (
                              <SelectItem key={implementation.key} value={implementation.key}>
                                {implementation.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">当前状态</p>
                        <div className="rounded-2xl border border-border/60 bg-card/90 p-3 text-sm leading-6 text-foreground/90">
                          <p>{selectedImplementation?.provider ?? "未知厂商"}</p>
                          <p className="mt-1 text-muted-foreground/75">
                            {selectedImplementation?.available ? "可用" : "缺少环境变量，暂不可用"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/60 bg-background/75 px-4 py-3 text-sm text-muted-foreground/80">
              <span>页面只展示 env key 名称，不展示密钥本身。</span>
              <span>{lastSavedAt ? `最近保存：${new Date(lastSavedAt).toLocaleString()}` : "尚未保存"}</span>
            </div>
          </SurfaceSection>
        </div>

        <div className="animate-in-up-d2 min-w-0">
          <SurfaceSection
            eyebrow="Implementation Catalog"
            title="实现目录"
            description="查看当前可选实现、适用步骤和环境依赖，作为步骤绑定前的快速参考。"
            actions={
              <MetaPillList
                items={[
                  { label: `${IMPLEMENTATIONS.length} 个实现`, icon: Wand2, tone: "primary" },
                  { label: `${STEPS.length} 个步骤`, icon: HardDriveDownload },
                ]}
              />
            }
            bodyClassName="space-y-3"
          >
            {IMPLEMENTATIONS.map((implementation) => (
              <article key={implementation.key} className="rounded-3xl border border-border/60 bg-background/75 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground/95">{implementation.name}</h3>
                    <p className="text-sm text-muted-foreground/80">{implementation.provider}</p>
                  </div>
                  <Badge variant={implementation.available ? "default" : "secondary"} className="text-xs">
                    {implementation.available ? "可用" : "不可用"}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {implementation.steps.map((step) => (
                    <Badge key={step} variant="secondary" className="text-xs">
                      {step}
                    </Badge>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground/75">
                  {implementation.requiredEnvKeys.length > 0
                    ? `缺少环境变量：${implementation.requiredEnvKeys.join("、")}`
                    : "无需额外环境变量"}
                </p>
              </article>
            ))}
          </SurfaceSection>
        </div>
      </div>
    </DashboardPageShell>
  );
}

export const AiConfigPage = AiConfigPageView;
