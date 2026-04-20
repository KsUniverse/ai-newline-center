"use client";

import { useEffect, useState } from "react";
import { AtSign, KeyRound, ShieldCheck, Sparkles, UserRound } from "lucide-react";

import {
  ManagementFieldShell,
  ManagementFormSection,
  ManagementNote,
  ManagementPanelHeading,
  managementCompactActionClassName,
} from "@/components/shared/common/management-primitives";
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
  SheetFooter,
  SheetHeader,
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
      ? ALL_ROLES.filter((currentRole) => currentRole.value === "EMPLOYEE")
      : ALL_ROLES;

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};

    if (!name.trim()) {
      nextErrors.name = "姓名不能为空";
    }

    if (mode === "create") {
      if (!account.trim()) {
        nextErrors.account = "账号不能为空";
      } else if (!/^[a-zA-Z0-9_]+$/.test(account)) {
        nextErrors.account = "账号只能包含字母、数字和下划线";
      }

      if (!password) {
        nextErrors.password = "密码不能为空";
      } else if (password.length < 6) {
        nextErrors.password = "密码至少 6 位";
      }

      if (!organizationId) {
        nextErrors.organizationId = "请选择所属分公司";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    if (mode === "create") {
      onSubmit({
        account: account.trim(),
        password,
        name: name.trim(),
        role,
        organizationId,
      });
      return;
    }

    onSubmit({ name: name.trim(), role });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-105 overflow-hidden p-0 sm:w-130">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--info)/0.06),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.06]" />

        <SheetHeader className="relative border-b border-border/35 px-6 py-6 text-left">
          <ManagementPanelHeading
            icon={UserRound}
            title={mode === "create" ? "新建用户" : "编辑用户"}
            description={
              mode === "create"
                ? "侧边入口保留与主 Dialog 一致的身份、权限与组织归属结构。"
                : "编辑模式只开放名称与角色，账号和组织归属继续保持只读。"
            }
          />
        </SheetHeader>

        <form onSubmit={handleSubmit} className="relative flex flex-col gap-5 px-6 py-6">
          <ManagementFormSection icon={UserRound} title="Identity">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-drawer-name">姓名 *</Label>
              <ManagementFieldShell icon={UserRound} iconClassName="border-primary/15 bg-primary/10">
                <Input
                  id="user-drawer-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="请输入姓名"
                  maxLength={50}
                  disabled={loading}
                  className="h-auto border-0 bg-transparent px-0 py-0 shadow-none"
                />
              </ManagementFieldShell>
              {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="user-drawer-account">账号 {mode === "create" ? "*" : ""}</Label>
                <ManagementFieldShell icon={AtSign}>
                  <Input
                    id="user-drawer-account"
                    value={mode === "create" ? account : (defaultValues?.account ?? "")}
                    onChange={(event) => {
                      if (mode === "create") {
                        setAccount(event.target.value);
                      }
                    }}
                    placeholder={mode === "create" ? "字母/数字/下划线" : undefined}
                    readOnly={mode === "edit"}
                    disabled={loading}
                    className={
                      mode === "edit"
                        ? "h-auto cursor-not-allowed border-0 bg-transparent px-0 py-0 text-muted-foreground shadow-none"
                        : "h-auto border-0 bg-transparent px-0 py-0 shadow-none"
                    }
                  />
                </ManagementFieldShell>
                {errors.account ? <p className="text-xs text-destructive">{errors.account}</p> : null}
                {mode === "edit" ? <p className="text-xs text-muted-foreground">账号创建后不可修改</p> : null}
              </div>

              {mode === "create" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="user-drawer-password">密码 *</Label>
                  <ManagementFieldShell icon={KeyRound}>
                    <Input
                      id="user-drawer-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="至少 6 位"
                      disabled={loading}
                      className="h-auto border-0 bg-transparent px-0 py-0 shadow-none"
                    />
                  </ManagementFieldShell>
                  {errors.password ? <p className="text-xs text-destructive">{errors.password}</p> : null}
                </div>
              ) : null}
            </div>
          </ManagementFormSection>

          <ManagementFormSection icon={ShieldCheck} title="Authorization" className="sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>角色 *</Label>
              <Select value={role} onValueChange={(value) => setRole(value as UserDTO["role"])} disabled={loading}>
                <SelectTrigger className="rounded-lg border-border/55 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((currentRole) => (
                    <SelectItem key={currentRole.value} value={currentRole.value}>
                      {currentRole.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>所属分公司 *</Label>
              {mode === "create" ? (
                <Select value={organizationId} onValueChange={setOrganizationId} disabled={loading}>
                  <SelectTrigger className="rounded-lg border-border/55 bg-card">
                    <SelectValue placeholder="请选择分公司" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((organization) => (
                      <SelectItem key={organization.id} value={organization.id}>
                        {organization.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={
                    organizations.find((organization) => organization.id === defaultValues?.organizationId)?.name ??
                    defaultValues?.organizationId ??
                    ""
                  }
                  readOnly
                  disabled={loading}
                  className="cursor-not-allowed rounded-lg border-border/55 bg-muted text-muted-foreground"
                />
              )}
              {errors.organizationId ? <p className="text-xs text-destructive">{errors.organizationId}</p> : null}
              {mode === "edit" ? <p className="text-xs text-muted-foreground">用户归属组织创建后不可修改</p> : null}
            </div>
          </ManagementFormSection>

          <ManagementNote icon={Sparkles} title="Management Note">
            角色决定可见范围，组织归属决定数据隔离链路；侧边入口与主弹框保持同一套说明结构。
          </ManagementNote>

          <SheetFooter className="gap-2 border-t border-border/35 pt-5">
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
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
