"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-100 sm:w-120">
        <SheetHeader>
          <SheetTitle>{mode === "create" ? "新建分公司" : "编辑分公司"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 py-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-name">公司名称 *</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入分公司名称"
              maxLength={100}
              disabled={loading}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <SheetFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "提交中..." : "提交"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
