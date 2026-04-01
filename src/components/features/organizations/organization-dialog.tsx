"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {mode === "create" ? "新建分公司" : "编辑分公司"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 py-2">
          <div className="flex flex-col gap-1.5">
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
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter className="gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "提交中..." : "确认"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
