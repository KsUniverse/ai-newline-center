"use client";

import { useEffect, useState } from "react";
import { Building2, Sparkles } from "lucide-react";

import {
  ManagementNote,
  ManagementPanelHeading,
  managementCompactActionClassName,
} from "@/components/shared/common/management-primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OrganizationDialogProps {
  mode: "create" | "edit";
  defaultValues?: { name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string }) => void;
  loading?: boolean;
}

export function OrganizationDialog({
  mode,
  defaultValues,
  open,
  onOpenChange,
  onSubmit,
  loading = false,
}: OrganizationDialogProps) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(defaultValues?.name ?? "");
      setError("");
    }
  }, [open, defaultValues]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("公司名称不能为空");
      return;
    }
    if (trimmed.length > 100) {
      setError("公司名称最多 100 个字符");
      return;
    }
    setError("");
    onSubmit({ name: trimmed });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/55 bg-card/95 p-0">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.06),transparent_28%)]" />
        <DialogHeader className="border-b border-border/35 px-6 py-6 text-left">
          <ManagementPanelHeading
            icon={Building2}
            title={mode === "create" ? "新建分公司" : "编辑分公司"}
            description={
              mode === "create"
                ? "创建组织后即可承载用户账号、内容账号和组织范围内的业务数据隔离。"
                : "编辑名称不会影响现有组织下的用户和账号归属关系。"
            }
          />
        </DialogHeader>

        <form onSubmit={handleSubmit} className="relative flex flex-col gap-5 px-6 py-6">
          <div className="rounded-xl border border-border/55 bg-background/80 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/85">Organization Identity</p>
                <Label htmlFor="org-name" className="mt-2 block text-sm font-medium">
                  公司名称 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="org-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入分公司名称"
                  maxLength={100}
                  disabled={loading}
                  autoFocus
                  className="mt-2 rounded-lg border-border/55 bg-card px-3.5 py-2.5"
                />
                <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                  {error ? <p className="text-destructive">{error}</p> : <span className="text-muted-foreground">建议使用稳定、易识别的正式组织名称。</span>}
                  <span className="shrink-0 font-mono text-muted-foreground/70">{name.length}/100</span>
                </div>
              </div>
            </div>
          </div>

          <ManagementNote icon={Sparkles} title="Usage Note">
            组织名称将用于用户归属、组织管理和权限范围展示，建议保持简洁且稳定。
          </ManagementNote>

          <DialogFooter className="gap-2 border-t border-border/35 pt-5">
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
