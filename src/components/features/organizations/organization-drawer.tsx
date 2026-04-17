"use client";

import { useEffect, useState } from "react";
import { Building2, Sparkles } from "lucide-react";

import {
  ManagementNote,
  ManagementPanelHeading,
  managementCompactActionClassName,
} from "@/components/shared/common/management-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
} from "@/components/ui/sheet";

interface OrganizationDrawerProps {
  mode: "create" | "edit";
  defaultValues?: { name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string }) => void;
  loading?: boolean;
}

export function OrganizationDrawer({
  mode,
  defaultValues,
  open,
  onOpenChange,
  onSubmit,
  loading = false,
}: OrganizationDrawerProps) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(defaultValues?.name ?? "");
      setError("");
    }
  }, [defaultValues, open]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("公司名称不能为空");
      return;
    }

    if (trimmedName.length > 100) {
      setError("公司名称最多 100 个字符");
      return;
    }

    setError("");
    onSubmit({ name: trimmedName });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-100 overflow-hidden p-0 sm:w-120">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.06),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.06]" />

        <SheetHeader className="relative border-b border-border/60 px-6 py-6 text-left">
          <ManagementPanelHeading
            icon={Building2}
            title={mode === "create" ? "新建分公司" : "编辑分公司"}
            description={
              mode === "create"
                ? "侧边入口与弹框表单保持同一套字段块和品牌化标题栏。"
                : "编辑名称不会影响现有组织归属与账号范围。"
            }
          />
        </SheetHeader>

        <form onSubmit={handleSubmit} className="relative flex flex-col gap-5 px-6 py-6">
          <div className="rounded-3xl border border-border/60 bg-background/80 p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-sm">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/85">Organization Identity</p>
                <Label htmlFor="organization-drawer-name" className="mt-2 block text-sm font-medium">
                  公司名称 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="organization-drawer-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="请输入分公司名称"
                  maxLength={100}
                  disabled={loading}
                  className="mt-2 rounded-2xl border-border/60 bg-card px-3.5 py-2.5"
                />
                <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                  {error ? <p className="text-destructive">{error}</p> : <span className="text-muted-foreground">建议使用稳定、易识别的正式组织名称。</span>}
                  <span className="shrink-0 font-mono text-muted-foreground/70">{name.length}/100</span>
                </div>
              </div>
            </div>
          </div>

          <ManagementNote icon={Sparkles} title="Usage Note">
            抽屉入口主要用于长路径编辑，但仍沿用主管理面板的字段块和说明语气。
          </ManagementNote>

          <SheetFooter className="gap-2 border-t border-border/60 pt-5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={managementCompactActionClassName}
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button type="submit" size="sm" className={managementCompactActionClassName} disabled={loading}>
              {loading ? "提交中..." : mode === "create" ? "创建分公司" : "保存修改"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
