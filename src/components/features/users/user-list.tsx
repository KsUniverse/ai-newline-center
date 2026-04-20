"use client";

import { Ban, MoreHorizontal, Pencil, RotateCcw, Sparkles, Users } from "lucide-react";

import type { OrganizationDTO } from "@/types/organization";
import type { UserDTO } from "@/types/user-management";
import {
  ManagementMetricCard,
  ManagementSidecar,
  StatusPill,
  managementMobileCardClassName,
  managementTableWrapperClassName,
} from "@/components/shared/common/management-primitives";
import { TaskEmptyState } from "@/components/shared/common/task-empty-state";
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
  SUPER_ADMIN: "超级管理员",
  BRANCH_MANAGER: "分公司负责人",
  EMPLOYEE: "员工",
};

const ROLE_STYLES: Record<UserDTO["role"], string> = {
  SUPER_ADMIN: "border-primary/20 bg-primary/10 text-primary",
  BRANCH_MANAGER: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  EMPLOYEE: "border-border/55 bg-background/80 text-muted-foreground",
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
  currentUserId?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getStatusMeta(status: UserDTO["status"]) {
  return status === "ACTIVE"
    ? {
        label: "正常",
        dotClassName: "bg-emerald-500",
      }
    : {
        label: "已禁用",
        dotClassName: "bg-muted-foreground/40",
      };
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
  currentUserId,
}: UserListProps) {
  const activeCount = users.filter((user) => user.status === "ACTIVE").length;
  const disabledCount = users.length - activeCount;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg border border-border/55 bg-background/80" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-lg border border-border/55 bg-background/80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <div className="grid gap-3 sm:grid-cols-3">
          <ManagementMetricCard label="账号规模" value={users.length} description="当前筛选范围下可见的用户账号" />
          <ManagementMetricCard label="正常状态" value={activeCount} description="仍可登录并继续使用的账号数量" />
          <ManagementMetricCard label="禁用状态" value={disabledCount} description="需要人工恢复后才可继续登录的账号" />
        </div>

        {showOrgFilter && organizations ? (
          <ManagementSidecar
            icon={Sparkles}
            title="Organization Filter"
            description="切换范围后，列表会立即聚焦到对应分公司的用户队列与启停状态。"
          >
            <Select
              value={selectedOrgId ?? "all"}
              onValueChange={(value) => onOrgFilterChange?.(value === "all" ? "" : value)}
            >
              <SelectTrigger className="mt-4 h-10 w-full rounded-lg border-border/55 bg-card/90 text-sm">
                <SelectValue placeholder="全部分公司" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">全部分公司</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id} className="text-sm">
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ManagementSidecar>
        ) : null}
      </div>

      {users.length === 0 ? (
        <TaskEmptyState
          icon={Users}
          eyebrow="User Intake"
          title="当前范围内还没有用户账号"
          description="先创建用户，再继续分配角色、组织归属和启停状态。"
          hint="列表与移动卡片视图会在创建后自动同步显示。"
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {users.map((user) => {
              const status = getStatusMeta(user.status);

              return (
                <div key={user.id} className={managementMobileCardClassName}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold tracking-tight text-foreground/95">{user.name}</p>
                        <span className={cn("inline-flex items-center rounded-md border px-2.5 py-1 text-2xs font-medium", ROLE_STYLES[user.role])}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground/80">{user.account}</p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">操作</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => onEdit(user)} className="cursor-pointer py-1.5 text-sm">
                          <Pencil className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onToggleStatus(user)}
                          disabled={user.id === currentUserId}
                          className={cn(
                            "cursor-pointer py-1.5 text-sm",
                            user.status === "ACTIVE" && user.id !== currentUserId ? "text-destructive focus:text-destructive" : "",
                          )}
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
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-border/55 bg-card/75 p-3">
                      <p className="text-2xs uppercase tracking-[0.18em] text-muted-foreground/70">所属分公司</p>
                      <p className="mt-1 text-sm font-medium text-foreground/90">{user.organization.name}</p>
                    </div>
                      <div className="rounded-lg border border-border/55 bg-card/75 p-3">
                        <p className="text-2xs uppercase tracking-[0.18em] text-muted-foreground/70">状态</p>
                        <StatusPill dotClassName={status.dotClassName} label={status.label} className="mt-1 border-0 bg-transparent px-0 py-0 shadow-none [&>span:last-child]:font-medium [&>span:last-child]:text-foreground/90" />
                      </div>
                  </div>

                  <p className="mt-4 text-sm text-muted-foreground/80">创建于 {formatDate(user.createdAt)}</p>
                </div>
              );
            })}
          </div>

          <div className={managementTableWrapperClassName}>
            <Table className="border-b-0 text-sm">
              <TableHeader className={cn("bg-background/85 backdrop-blur-sm")}>
                <TableRow className="hover:bg-transparent border-border/55 *:h-11 *:align-middle">
                  <TableHead className="pl-5 font-semibold text-foreground/70">姓名</TableHead>
                  <TableHead className="font-semibold text-foreground/70">账号</TableHead>
                  <TableHead className="w-36 font-semibold text-foreground/70">角色</TableHead>
                  <TableHead className="w-40 font-semibold text-foreground/70">所属分公司</TableHead>
                  <TableHead className="w-24 font-semibold text-foreground/70">状态</TableHead>
                  <TableHead className="w-36 font-semibold text-foreground/70">创建时间</TableHead>
                  <TableHead className="w-16 pr-5 text-right font-semibold text-foreground/70">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const status = getStatusMeta(user.status);

                  return (
                    <TableRow key={user.id} className="group border-border/55 transition-colors hover:bg-primary/5">
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                            <Users className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground/95">{user.name}</p>
                            <p className="text-xs text-muted-foreground/70">账户档案已纳入统一身份与权限管理</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground/80">{user.account}</TableCell>
                      <TableCell>
                        <div className={cn("inline-flex items-center rounded-md border px-2.5 py-1 text-2xs font-medium", ROLE_STYLES[user.role])}>
                          {ROLE_LABELS[user.role]}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.organization.name}</TableCell>
                      <TableCell>
                        <StatusPill dotClassName={status.dotClassName} label={status.label} />
                      </TableCell>
                      <TableCell className="tabular-nums tracking-tight text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                      <TableCell className="pr-5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="-mr-1 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">操作</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onClick={() => onEdit(user)} className="cursor-pointer py-1.5 text-sm">
                              <Pencil className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onToggleStatus(user)}
                              disabled={user.id === currentUserId}
                              className={cn(
                                "cursor-pointer py-1.5 text-sm",
                                user.status === "ACTIVE" && user.id !== currentUserId ? "text-destructive focus:text-destructive" : "",
                              )}
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
