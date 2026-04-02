"use client";

import { MoreHorizontal, Pencil, Ban, RotateCcw } from "lucide-react";

import type { OrganizationDTO } from "@/types/organization";
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

export function OrganizationList({
  organizations,
  onEdit,
  onToggleStatus,
  loading,
}: OrganizationListProps) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-background shadow-xs overflow-hidden">
      <Table className="text-sm border-b-0">
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-border/60 *:h-10 *:align-middle">
            <TableHead className="font-semibold text-foreground/70 pl-5">公司名称</TableHead>
            <TableHead className="w-24 text-right font-semibold text-foreground/70">用户数</TableHead>
            <TableHead className="w-28 font-semibold text-foreground/70">状态</TableHead>
            <TableHead className="w-40 font-semibold text-foreground/70">创建时间</TableHead>
            <TableHead className="w-16 text-right font-semibold text-foreground/70 pr-5">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.length === 0 && (
            <TableRow className="border-b-0">
              <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                暂无分公司数据
              </TableCell>
            </TableRow>
          )}
          {organizations.map((org) => (
            <TableRow key={org.id} className="border-border/60 hover:bg-muted/30 transition-colors group">
              <TableCell className="font-medium pl-5">{org.name}</TableCell>
              <TableCell className="text-right text-muted-foreground/80 font-mono">
                {org._count?.users ?? 0}
              </TableCell>
              <TableCell>
                {org.status === "ACTIVE" ? (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">正常</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    <span className="text-muted-foreground">已禁用</span>
                  </div>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground tracking-tight tabular-nums">{formatDate(org.createdAt)}</TableCell>
              <TableCell className="text-right pr-5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 data-[state=open]:opacity-100 -mr-1">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">操作</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => onEdit(org)} className="text-sm py-1.5 cursor-pointer">
                      <Pencil className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onToggleStatus(org)}
                      className={cn("text-sm py-1.5 cursor-pointer", org.status === "ACTIVE" ? "text-destructive focus:text-destructive" : "")}
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
