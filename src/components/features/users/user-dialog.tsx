"use client";

import { useEffect, useState } from "react";

import type { OrganizationDTO } from "@/types/organization";
import type { UserDTO } from "@/types/user-management";
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {mode === "create" ? "新建用户" : "编辑用户"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-1">
          {/* 姓名 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-name" className="text-sm font-medium">
              姓名 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入姓名"
              maxLength={50}
              disabled={loading}
              autoFocus
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* 账号 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-account" className="text-sm font-medium">
              账号 {mode === "create" && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="user-account"
              value={mode === "create" ? account : (defaultValues?.account ?? "")}
              onChange={(e) => mode === "create" && setAccount(e.target.value)}
              placeholder={mode === "create" ? "字母/数字/下划线" : undefined}
              readOnly={mode === "edit"}
              disabled={loading}
              className={mode === "edit" ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
            />
            {errors.account && <p className="text-xs text-destructive">{errors.account}</p>}
            {mode === "edit" && (
              <p className="text-xs text-muted-foreground">账号创建后不可修改</p>
            )}
          </div>

          {/* 密码 — 仅创建时 */}
          {mode === "create" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-password" className="text-sm font-medium">
                密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="user-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                disabled={loading}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>
          )}

          {/* 角色 */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">
              角色 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as UserDTO["role"])}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="text-sm">
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 所属分公司 */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">
              所属分公司 {mode === "create" && <span className="text-destructive">*</span>}
            </Label>
            {mode === "create" ? (
              <Select
                value={organizationId}
                onValueChange={setOrganizationId}
                disabled={loading}
              >
                <SelectTrigger>
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
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
            )}
            {errors.organizationId && (
              <p className="text-xs text-destructive">{errors.organizationId}</p>
            )}
            {mode === "edit" && (
              <p className="text-xs text-muted-foreground">用户归属组织创建后不可修改</p>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
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
