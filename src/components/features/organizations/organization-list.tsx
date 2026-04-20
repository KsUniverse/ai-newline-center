"use client";

import { Ban, Building2, MoreHorizontal, Pencil, RotateCcw, Sparkles } from "lucide-react";

import type { OrganizationDTO } from "@/types/organization";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OrganizationListProps {
  organizations: OrganizationDTO[];
  onEdit: (org: OrganizationDTO) => void;
  onToggleStatus: (org: OrganizationDTO) => void;
  loading?: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getStatusMeta(status: OrganizationDTO["status"]) {
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

export function OrganizationList({
  organizations,
  onEdit,
  onToggleStatus,
  loading,
}: OrganizationListProps) {
  const activeCount = organizations.filter((org) => org.status === "ACTIVE").length;
  const totalUsers = organizations.reduce((count, org) => count + (org._count?.users ?? 0), 0);

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
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
        <div className="grid gap-3 sm:grid-cols-3">
          <ManagementMetricCard label="分公司规模" value={organizations.length} description="当前纳入统一管理的组织数量" />
          <ManagementMetricCard label="账号承载" value={totalUsers} description="分布在各分公司的累计用户账号" />
          <ManagementMetricCard label="可用状态" value={activeCount} description="仍处于正常运行状态的分公司" />
        </div>

        <ManagementSidecar
          icon={Sparkles}
          title="Admin Hint"
          description="禁用分公司会联动其下用户状态，启用分公司后仍需按需恢复具体账号。"
        />
      </div>

      {organizations.length === 0 ? (
        <TaskEmptyState
          icon={Building2}
          eyebrow="Organization Setup"
          title="还没有分公司档案"
          description="先创建分公司，再继续分配用户和管理组织状态。"
          hint="组织会作为后续账号、用户和研究数据的范围基础。"
          tone="muted"
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {organizations.map((org) => {
              const status = getStatusMeta(org.status);

              return (
                <div key={org.id} className={managementMobileCardClassName}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <p className="text-base font-semibold tracking-tight text-foreground/95">{org.name}</p>
                      </div>
                      <StatusPill dotClassName={status.dotClassName} label={status.label} className="border-0 bg-transparent px-0 py-0 shadow-none" />
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">操作</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => onEdit(org)} className="cursor-pointer py-1.5 text-sm">
                          <Pencil className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onToggleStatus(org)}
                          className={cn("cursor-pointer py-1.5 text-sm", org.status === "ACTIVE" ? "text-destructive focus:text-destructive" : "")}
                        >
                          {org.status === "ACTIVE" ? (
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
                      <p className="text-2xs uppercase tracking-[0.18em] text-muted-foreground/70">用户数</p>
                      <p className="mt-1 text-sm font-medium text-foreground/90">{org._count?.users ?? 0} 个</p>
                    </div>
                    <div className="rounded-lg border border-border/55 bg-card/75 p-3">
                      <p className="text-2xs uppercase tracking-[0.18em] text-muted-foreground/70">创建时间</p>
                      <p className="mt-1 text-sm font-medium text-foreground/90">{formatDate(org.createdAt)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={managementTableWrapperClassName}>
            <Table className="border-b-0 text-sm">
              <TableHeader className="bg-background/85 backdrop-blur-sm">
                <TableRow className="hover:bg-transparent border-border/55 *:h-11 *:align-middle">
                  <TableHead className="pl-5 font-semibold text-foreground/70">公司名称</TableHead>
                  <TableHead className="w-24 text-right font-semibold text-foreground/70">用户数</TableHead>
                  <TableHead className="w-28 font-semibold text-foreground/70">状态</TableHead>
                  <TableHead className="w-40 font-semibold text-foreground/70">创建时间</TableHead>
                  <TableHead className="w-16 pr-5 text-right font-semibold text-foreground/70">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => {
                  const status = getStatusMeta(org.status);

                  return (
                    <TableRow key={org.id} className="group border-border/55 transition-colors hover:bg-primary/5">
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground/95">{org.name}</p>
                            <p className="text-xs text-muted-foreground/70">组织档案已纳入统一权限与账号管理</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground/80">{org._count?.users ?? 0}</TableCell>
                      <TableCell>
                        <StatusPill dotClassName={status.dotClassName} label={status.label} />
                      </TableCell>
                      <TableCell className="tabular-nums tracking-tight text-muted-foreground">{formatDate(org.createdAt)}</TableCell>
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
                            <DropdownMenuItem onClick={() => onEdit(org)} className="cursor-pointer py-1.5 text-sm">
                              <Pencil className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onToggleStatus(org)}
                              className={cn("cursor-pointer py-1.5 text-sm", org.status === "ACTIVE" ? "text-destructive focus:text-destructive" : "")}
                            >
                              {org.status === "ACTIVE" ? (
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
