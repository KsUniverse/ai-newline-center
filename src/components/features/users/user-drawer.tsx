"use client";

import { useEffect, useState } from "react";
import { AtSign, KeyRound, ShieldCheck, Sparkles, UserRound } from "lucide-react";

import type { OrganizationDTO } from "@/types/organization";
import type { UserDTO } from "@/types/user-management";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";

type CallerRole = "SUPER_ADMIN" | "BRANCH_MANAGER" | "EMPLOYEE";

export interface CreateUserData {
  account: string;
  password: string;
  name: string;
  role: UserDTO["role"];
  organizationId: string;
}

export interface UpdateUserData {
  name: string;
  role: UserDTO["role"];
}

interface UserDrawerProps {
  mode: "create" | "edit";
  defaultValues?: Partial<UserDTO>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateUserData | UpdateUserData) => void;
  loading?: boolean;
  organizations: Pick<OrganizationDTO, "id" | "name">[];
  callerRole: CallerRole;
}

const ALL_ROLES: { value: UserDTO["role"]; label: string }[] = [
  { value: "SUPER_ADMIN", label: "超级管理员" },
  { value: "BRANCH_MANAGER", label: "分公司负责人" },
  { value: "EMPLOYEE", label: "员工" },
];

export function UserDrawer({
  mode,
  defaultValues,
  open,
  onOpenChange,
  onSubmit,
  loading = false,
  organizations,
  callerRole,
}: UserDrawerProps) {
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserDTO["role"]>("EMPLOYEE");
  const [organizationId, setOrganizationId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(defaultValues?.name ?? "");
      setAccount(defaultValues?.account ?? "");
      setPassword("");
      setRole(defaultValues?.role ?? "EMPLOYEE");
      setOrganizationId(defaultValues?.organizationId ?? "");
      setErrors({});
    }
  }, [open, defaultValues]);

  const availableRoles =
    callerRole === "BRANCH_MANAGER"
      ? ALL_ROLES.filter((r) => r.value === "EMPLOYEE")
      : ALL_ROLES;

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "姓名不能为空";
    if (mode === "create") {
      if (!account.trim()) errs.account = "账号不能为空";
      else if (!/^[a-zA-Z0-9_]+$/.test(account)) errs.account = "账号只能包含字母、数字和下划线";
      if (!password) errs.password = "密码不能为空";
      else if (password.length < 6) errs.password = "密码至少 6 位";
      if (!organizationId) errs.organizationId = "请选择所属分公司";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (mode === "create") {
      onSubmit({ account: account.trim(), password, name: name.trim(), role, organizationId });
    } else {
      onSubmit({ name: name.trim(), role });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-105 overflow-hidden p-0 sm:w-130">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.06),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.06]" />

        <SheetHeader className="relative border-b border-border/60 px-6 py-6 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-sm">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">Administration</p>
              <SheetTitle>{mode === "create" ? "新建用户" : "编辑用户"}</SheetTitle>
              <SheetDescription>
                {mode === "create"
                  ? "侧边入口保留与主 Dialog 一致的身份、权限与组织归属结构。"
                  : "编辑模式只开放名称与角色，账号和组织归属继续保持只读。"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="relative flex flex-col gap-5 px-6 py-6">
          <div className="grid gap-4 rounded-3xl border border-border/60 bg-background/80 p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2 text-primary">
              <UserRound className="h-4 w-4" />
              <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/85">Identity</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-name">姓名 *</Label>
              <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/90 px-3 py-2.5 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                  <UserRound className="h-4 w-4" />
                </span>
                <Input
                  id="user-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入姓名"
                  maxLength={50}
                  disabled={loading}
                  className="h-auto border-0 bg-transparent px-0 py-0 shadow-none"
                />
              </div>
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="user-account">账号 {mode === "create" ? "*" : ""}</Label>
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/90 px-3 py-2.5 shadow-sm">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/90 text-primary">
                    <AtSign className="h-4 w-4" />
                  </span>
                  <Input
                    id="user-account"
                    value={mode === "create" ? account : (defaultValues?.account ?? "")}
                    onChange={(e) => mode === "create" && setAccount(e.target.value)}
                    placeholder={mode === "create" ? "字母/数字/下划线" : undefined}
                    readOnly={mode === "edit"}
                    disabled={loading}
                    className={mode === "edit" ? "h-auto cursor-not-allowed border-0 bg-transparent px-0 py-0 text-muted-foreground shadow-none" : "h-auto border-0 bg-transparent px-0 py-0 shadow-none"}
                  />
                </div>
                {errors.account && <p className="text-xs text-destructive">{errors.account}</p>}
                {mode === "edit" && <p className="text-xs text-muted-foreground">账号创建后不可修改</p>}
              </div>

              {mode === "create" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="user-password">密码 *</Label>
                  <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/90 px-3 py-2.5 shadow-sm">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/90 text-primary">
                      <KeyRound className="h-4 w-4" />
                    </span>
                    <Input
                      id="user-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="至少 6 位"
                      disabled={loading}
                      className="h-auto border-0 bg-transparent px-0 py-0 shadow-none"
                    />
                  </div>
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 rounded-3xl border border-border/60 bg-background/80 p-4 shadow-sm sm:grid-cols-2 sm:p-5">
            <div className="sm:col-span-2 flex items-center gap-2 text-primary">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/85">Authorization</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>角色 *</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as UserDTO["role"])}
                disabled={loading}
              >
                <SelectTrigger className="rounded-2xl border-border/60 bg-card shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>所属分公司 *</Label>
              {mode === "create" ? (
                <Select
                  value={organizationId}
                  onValueChange={setOrganizationId}
                  disabled={loading}
                >
                  <SelectTrigger className="rounded-2xl border-border/60 bg-card shadow-sm">
                    <SelectValue placeholder="请选择分公司" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={organizations.find((o) => o.id === defaultValues?.organizationId)?.name ?? defaultValues?.organizationId ?? ""}
                  readOnly
                  disabled={loading}
                  className="cursor-not-allowed rounded-2xl border-border/60 bg-muted text-muted-foreground"
                />
              )}
              {errors.organizationId && (
                <p className="text-xs text-destructive">{errors.organizationId}</p>
              )}
              {mode === "edit" && (
                <p className="text-xs text-muted-foreground">用户归属组织创建后不可修改</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-background/80 px-4 py-4 shadow-sm">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/85">Management Note</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground/80">
              角色决定可见范围，组织归属决定数据隔离链路；侧边入口与主弹框保持同一套说明结构。
            </p>
          </div>

          <SheetFooter className="gap-2 border-t border-border/60 pt-5">
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
              {loading ? "提交中..." : mode === "create" ? "创建用户" : "保存修改"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
