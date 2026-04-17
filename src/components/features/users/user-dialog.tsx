"use client";

import { useEffect, useState } from "react";
import { AtSign, KeyRound, ShieldCheck, Sparkles, UserRound } from "lucide-react";

import type { OrganizationDTO } from "@/types/organization";
import type { UserDTO } from "@/types/user-management";
import {
  ManagementFieldShell,
  ManagementFormSection,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface UserDialogProps {
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

export function UserDialog({
  mode,
  defaultValues,
  open,
  onOpenChange,
  onSubmit,
  loading = false,
  organizations,
  callerRole,
}: UserDialogProps) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/60 bg-card/95 p-0 shadow-2xl shadow-black/15">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.06),transparent_28%)]" />
        <DialogHeader className="border-b border-border/60 px-6 py-6 text-left">
          <ManagementPanelHeading
            icon={UserRound}
            title={mode === "create" ? "新建用户" : "编辑用户"}
            description={
              mode === "create"
                ? "创建后即可分配角色与组织归属，并进入统一的用户管理列表。"
                : "只允许编辑用户名称与角色；账号与组织归属保持只读。"
            }
          />
        </DialogHeader>

        <form onSubmit={handleSubmit} className="relative flex flex-col gap-5 px-6 py-6">
          <ManagementFormSection icon={UserRound} title="Identity">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-name" className="text-sm font-medium">
                姓名 <span className="text-destructive">*</span>
              </Label>
              <ManagementFieldShell icon={UserRound} iconClassName="border-primary/15 bg-primary/10">
                <Input
                  id="user-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入姓名"
                  maxLength={50}
                  disabled={loading}
                  autoFocus
                  className="h-auto border-0 bg-transparent px-0 py-0 shadow-none"
                />
              </ManagementFieldShell>
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="user-account" className="text-sm font-medium">
                  账号 {mode === "create" && <span className="text-destructive">*</span>}
                </Label>
                <ManagementFieldShell icon={AtSign}>
                  <Input
                    id="user-account"
                    value={mode === "create" ? account : (defaultValues?.account ?? "")}
                    onChange={(e) => mode === "create" && setAccount(e.target.value)}
                    placeholder={mode === "create" ? "字母/数字/下划线" : undefined}
                    readOnly={mode === "edit"}
                    disabled={loading}
                    className={mode === "edit" ? "h-auto cursor-not-allowed border-0 bg-transparent px-0 py-0 text-muted-foreground shadow-none" : "h-auto border-0 bg-transparent px-0 py-0 shadow-none"}
                  />
                </ManagementFieldShell>
                {errors.account && <p className="text-xs text-destructive">{errors.account}</p>}
                {mode === "edit" ? <p className="text-xs text-muted-foreground">账号创建后不可修改</p> : null}
              </div>

              {mode === "create" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="user-password" className="text-sm font-medium">
                    密码 <span className="text-destructive">*</span>
                  </Label>
                  <ManagementFieldShell icon={KeyRound}>
                    <Input
                      id="user-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="至少 6 位"
                      disabled={loading}
                      className="h-auto border-0 bg-transparent px-0 py-0 shadow-none"
                    />
                  </ManagementFieldShell>
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
              ) : null}
            </div>
          </ManagementFormSection>

          <ManagementFormSection icon={ShieldCheck} title="Authorization" className="sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">
                角色 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as UserDTO["role"])}
                disabled={loading}
              >
                <SelectTrigger className="rounded-2xl border-border/60 bg-card shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((currentRole) => (
                    <SelectItem key={currentRole.value} value={currentRole.value} className="text-sm">
                      {currentRole.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">
                所属分公司 {mode === "create" && <span className="text-destructive">*</span>}
              </Label>
              {mode === "create" ? (
                <Select value={organizationId} onValueChange={setOrganizationId} disabled={loading}>
                  <SelectTrigger className="rounded-2xl border-border/60 bg-card shadow-sm">
                    <SelectValue placeholder="请选择分公司" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id} className="text-sm">
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={
                    organizations.find((o) => o.id === defaultValues?.organizationId)?.name ??
                    defaultValues?.organizationId ?? ""
                  }
                  readOnly
                  disabled={loading}
                  className="cursor-not-allowed rounded-2xl border-border/60 bg-muted text-muted-foreground"
                />
              )}
              {errors.organizationId ? <p className="text-xs text-destructive">{errors.organizationId}</p> : null}
              {mode === "edit" ? <p className="text-xs text-muted-foreground">用户归属组织创建后不可修改</p> : null}
            </div>
          </ManagementFormSection>

          <ManagementNote icon={Sparkles} title="Management Note">
            角色决定该账号可见的管理范围；组织归属决定它会进入哪一条数据隔离链路。
          </ManagementNote>

          <DialogFooter className="gap-2 border-t border-border/60 pt-5">
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
              {loading ? "提交中..." : mode === "create" ? "创建用户" : "保存修改"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
