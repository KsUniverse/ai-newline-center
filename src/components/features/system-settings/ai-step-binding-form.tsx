"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { AiSettingsDTO, AiStep, UpdateAiSettingsInput } from "@/types/ai-config";
import { managementClient } from "@/lib/management-client";
import { Button } from "@/components/ui/button";

const STEP_LABELS: Record<AiStep, string> = {
  TRANSCRIBE: "转录",
  DECOMPOSE: "拆解",
  REWRITE: "仿写",
};

interface AiStepBindingFormProps {
  config: AiSettingsDTO;
  onSaved: (config: AiSettingsDTO) => void;
}

export function AiStepBindingForm({ config, onSaved }: AiStepBindingFormProps) {
  const initialBindings = config.bindings ?? config.steps ?? [];
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<AiStep, string | null>>(() =>
    Object.fromEntries(
      initialBindings.map((binding) => [binding.step, binding.implementationKey ?? null]),
    ) as Record<AiStep, string | null>,
  );

  const options = useMemo(
    () =>
      config.implementations.map((implementation) => ({
        value: implementation.key,
        label: implementation.name,
        disabled: !implementation.available,
      })),
    [config.implementations],
  );

  async function handleSave() {
    setSaving(true);
    try {
      const bindings = (Object.keys(STEP_LABELS) as AiStep[]).map((step) => ({
        step,
        implementationKey: values[step],
      }));
      const payload: UpdateAiSettingsInput = {
        bindings,
      };
      const next = await managementClient.updateAiConfig(payload);
      onSaved(next);
      toast.success("AI 配置已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 配置保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm">
      <div className="space-y-1.5">
        <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/85">
          Step Binding
        </p>
        <h2 className="text-lg font-semibold tracking-tight text-foreground/95">步骤绑定</h2>
        <p className="text-sm leading-6 text-muted-foreground/80">
          当前系统级默认绑定决定新的转录、拆解、仿写请求会命中哪个实现。
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {(Object.keys(STEP_LABELS) as AiStep[]).map((step) => (
          <div
            key={step}
            className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/80 p-4 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-foreground/95">{STEP_LABELS[step]}</p>
              <p className="text-xs text-muted-foreground/75">系统默认实现</p>
            </div>
            <select
              value={values[step] ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [step]: event.target.value === "" ? null : event.target.value,
                }))
              }
              className="h-10 min-w-[220px] rounded-xl border border-border/60 bg-card px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/30"
            >
              <option value="">未绑定</option>
              {options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? "保存中…" : "保存 AI 配置"}
        </Button>
      </div>
    </section>
  );
}
