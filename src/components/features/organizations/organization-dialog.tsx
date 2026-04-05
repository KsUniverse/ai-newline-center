"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
      <DialogContent className="max-w-lg border-border/60 bg-card/95 p-0 shadow-2xl shadow-black/15">
        <DialogHeader className="border-b border-border/60 px-6 py-6 text-left">
          <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
            Administration
          </p>
          <DialogTitle className="text-lg font-semibold tracking-tight text-foreground/95">
            {mode === "create" ? "新建分公司" : "编辑分公司"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-muted-foreground/80">
            {mode === "create"
              ? "创建组织后即可承载用户账号、内容账号和组织范围内的业务数据隔离。"
              : "编辑名称不会影响现有组织下的用户和账号归属关系。"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-6">
          <div className="rounded-3xl border border-border/60 bg-background/80 p-4 shadow-sm sm:p-5">
            <Label htmlFor="org-name" className="text-sm font-medium">
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
              className="mt-2 border-border/60 bg-card"
            />
            {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
            <p className="mt-2 text-xs text-muted-foreground">
              组织名称将用于用户归属、组织管理和权限范围展示，建议保持简洁且稳定。
            </p>
          </div>

          <DialogFooter className="gap-2 border-t border-border/60 pt-5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-md px-3 text-sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button type="submit" size="sm" className="h-8 rounded-md px-3 text-sm" disabled={loading}>
              {loading ? "提交中..." : mode === "create" ? "创建分公司" : "保存修改"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
