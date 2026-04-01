"use client";

import { MoreHorizontal, Pencil, Ban, RotateCcw } from "lucide-react";

import type { OrganizationDTO } from "@/types/organization";
import type { UserDTO } from "@/types/user-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLE_LABELS: Record<UserDTO["role"], string> = {
  SUPER_ADMIN: "超级管理�?,
  BRANCH_MANAGER: "分公司负责人",
  EMPLOYEE: "员工",
};

interface UserListProps {
  users: UserDTO[];
  onEdit: (user: UserDTO) => void;
  onToggleStatus: (user: UserDTO) => void;
  organizations?: Pick<OrganizationDTO, "id" | "name">[];
  showOrgFilter?: boolean;
  onOrgFilterChange?: (orgId: string) => void;
  selectedOrgId?: string;
  loading?: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function UserList({
  users,
  onEdit,
  onToggleStatus,
  organizations,
  showOrgFilter = false,
  onOrgFilterChange,
  selectedOrgId,
  loading,
}: UserListProps) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        加载�?..
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 rounded-lg border border-border/60 bg-background shadow-xs overflow-hidden">
      {showOrgFilter && organizations && (
        <div className="flex items-center gap-3 border-b border-border/60 px-5 py-3 bg-muted/10">
          <span className="text-sm text-muted-foreground/80">按分公司筛选：</span>
          <Select
            value={selectedOrgId ?? "all"}
            onValueChange={(v) => onOrgFilterChange?.(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-56 text-sm border-border/60 shadow-xs">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-sm">全部</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id} className="text-sm">
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Table className="text-sm border-b-0">
        <TableHeader className={cn(!showOrgFilter && "bg-muted/30")}>
          <TableRow className="hover:bg-transparent border-border/60 *:h-10 *:align-middle">
            <TableHead className="font-semibold text-foreground/70 pl-5">姓名</TableHead>
            <TableHead className="font-semibold text-foreground/70">账号</TableHead>
            <TableHead className="w-36 font-semibold text-foreground/70">角色</TableHead>
            <TableHead className="w-40 font-semibold text-foreground/70">所属分公司</TableHead>
            <TableHead className="w-24 font-semibold text-foreground/70">状�?/TableHead>
            <TableHead className="w-36 font-semibold text-foreground/70">创建时间</TableHead>
            <TableHead className="w-16 text-right font-semibold text-foreground/70 pr-5">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 && (
            <TableRow className="border-b-0">
              <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                暂无用户数据
              </TableCell>
            </TableRow>
          )}
          {users.map((user) => (
            <TableRow key={user.id} className="border-border/60 hover:bg-muted/30 transition-colors group">
              <TableCell className="font-medium pl-5">{user.name}</TableCell>
              <TableCell className="text-muted-foreground/80 font-mono text-xs">{user.account}</TableCell>
              <TableCell>
                <div className="inline-flex items-center rounded-sm px-2 py-0.5 text-2xs font-medium bg-muted text-muted-foreground">
                  {ROLE_LABELS[user.role]}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{user.organization.name}</TableCell>
              <TableCell>
                {user.status === "ACTIVE" ? (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">正常</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    <span className="text-muted-foreground">已禁�?/span>
                  </div>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground tracking-tight tabular-nums">{formatDate(user.createdAt)}</TableCell>
              <TableCell className="text-right pr-5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 data-[state=open]:opacity-100 -mr-1">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">操作</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => onEdit(user)} className="text-sm py-1.5 cursor-pointer">
                      <Pencil className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onToggleStatus(user)}
                      className={cn("text-sm py-1.5 cursor-pointer", user.status === "ACTIVE" ? "text-destructive focus:text-destructive" : "")}
                    >
                      {user.status === "ACTIVE" ? (
                        <>
                          <Ban className="mr-2 h-3.5 w-3.5 text-destructive/70" />
                          禁用
                        </>
                      ) : (
                        <>
                          <RotateCcw className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                          启用
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
