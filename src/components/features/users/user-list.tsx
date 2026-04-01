"use client";

import { MoreHorizontal, Pencil, Ban, RotateCcw } from "lucide-react";

import type { OrganizationDTO } from "@/types/organization";
import type { UserDTO } from "@/types/user-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  SUPER_ADMIN: "超级管理员",
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
        加载中...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {showOrgFilter && organizations && (
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="text-sm text-muted-foreground">按分公司筛选：</span>
          <Select
            value={selectedOrgId ?? "all"}
            onValueChange={(v) => onOrgFilterChange?.(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-48">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>姓名</TableHead>
            <TableHead>账号</TableHead>
            <TableHead className="w-36">角色</TableHead>
            <TableHead className="w-36">所属分公司</TableHead>
            <TableHead className="w-24">状态</TableHead>
            <TableHead className="w-36">创建时间</TableHead>
            <TableHead className="w-16 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                暂无用户数据
              </TableCell>
            </TableRow>
          )}
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs">{user.account}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {ROLE_LABELS[user.role]}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{user.organization.name}</TableCell>
              <TableCell>
                {user.status === "ACTIVE" ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 bg-emerald-500/10">
                    正常
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    已禁用
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">操作</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(user)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onToggleStatus(user)}
                      className={user.status === "ACTIVE" ? "text-destructive focus:text-destructive" : ""}
                    >
                      {user.status === "ACTIVE" ? (
                        <>
                          <Ban className="mr-2 h-4 w-4" />
                          禁用
                        </>
                      ) : (
                        <>
                          <RotateCcw className="mr-2 h-4 w-4" />
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
