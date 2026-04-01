"use client";

import { MoreHorizontal, Pencil, Ban, RotateCcw } from "lucide-react";

import type { OrganizationDTO } from "@/types/organization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>公司名称</TableHead>
          <TableHead className="w-20 text-right">用户数</TableHead>
          <TableHead className="w-24">状态</TableHead>
          <TableHead className="w-36">创建时间</TableHead>
          <TableHead className="w-16 text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {organizations.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
              暂无分公司数据
            </TableCell>
          </TableRow>
        )}
        {organizations.map((org) => (
          <TableRow key={org.id}>
            <TableCell className="font-medium">{org.name}</TableCell>
            <TableCell className="text-right text-muted-foreground">
              {org._count?.users ?? 0}
            </TableCell>
            <TableCell>
              {org.status === "ACTIVE" ? (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 bg-emerald-500/10">
                  正常
                </Badge>
              ) : (
                <Badge variant="outline" className="border-border text-muted-foreground">
                  已禁用
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">{formatDate(org.createdAt)}</TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">操作</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(org)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onToggleStatus(org)}
                    className={org.status === "ACTIVE" ? "text-destructive focus:text-destructive" : ""}
                  >
                    {org.status === "ACTIVE" ? (
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
  );
}
