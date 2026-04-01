"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import type { OrganizationDTO } from "@/types/organization";
import { mockOrganizations } from "@/components/features/organizations/__mocks__/organizations";
import { OrganizationList } from "@/components/features/organizations/organization-list";
import { OrganizationDialog } from "@/components/features/organizations/organization-dialog";
import { ConfirmDialog } from "@/components/shared/common/confirm-dialog";
import { Button } from "@/components/ui/button";

export default function OrganizationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [organizations, setOrganizations] = useState<OrganizationDTO[]>(mockOrganizations);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [selectedOrg, setSelectedOrg] = useState<OrganizationDTO | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatusOrg, setPendingStatusOrg] = useState<OrganizationDTO | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Client-side permission guard
  const redirected = useRef(false);
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "SUPER_ADMIN" && !redirected.current) {
      redirected.current = true;
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  if (status === "loading" || (status === "authenticated" && session?.user?.role !== "SUPER_ADMIN")) {
    return null;
  }

  function handleCreate() {
    setDrawerMode("create");
    setSelectedOrg(null);
    setDrawerOpen(true);
  }

  function handleEdit(org: OrganizationDTO) {
    setDrawerMode("edit");
    setSelectedOrg(org);
    setDrawerOpen(true);
  }

  function handleToggleStatus(org: OrganizationDTO) {
    setPendingStatusOrg(org);
    setConfirmOpen(true);
  }

  function handleDrawerSubmit(data: { name: string }) {
    setSubmitting(true);
    // Mock: simulate async
    setTimeout(() => {
      if (drawerMode === "create") {
        const newOrg: OrganizationDTO = {
          id: `org_branch_${Date.now()}`,
          name: data.name,
          type: "BRANCH",
          status: "ACTIVE",
          parentId: "seed_default_group",
          createdAt: new Date().toISOString(),
          _count: { users: 0 },
        };
        setOrganizations((prev) => [...prev, newOrg]);
        toast.success("分公司创建成功");
      } else if (selectedOrg) {
        setOrganizations((prev) =>
          prev.map((o) => (o.id === selectedOrg.id ? { ...o, name: data.name } : o)),
        );
        toast.success("分公司信息已更新");
      }
      setDrawerOpen(false);
      setSubmitting(false);
    }, 500);
  }

  function handleConfirmStatus() {
    if (!pendingStatusOrg) return;
    setSubmitting(true);
    setTimeout(() => {
      const nextStatus = pendingStatusOrg.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
      setOrganizations((prev) =>
        prev.map((o) =>
          o.id === pendingStatusOrg.id ? { ...o, status: nextStatus } : o,
        ),
      );
      const label = nextStatus === "DISABLED" ? "已禁用" : "已启用";
      toast.success(`「${pendingStatusOrg.name}」${label}`);
      setConfirmOpen(false);
      setPendingStatusOrg(null);
      setSubmitting(false);
    }, 500);
  }

  const userCount = pendingStatusOrg?._count?.users ?? 0;
  const confirmDescription =
    pendingStatusOrg?.status === "ACTIVE"
      ? `该分公司下 ${userCount} 个用户账号将同时被禁用，是否继续？`
      : `启用后分公司下用户账号状态不会自动恢复，需手动单独启用。是否继续？`;

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight leading-none text-foreground/90">组织管理</h1>
          <p className="text-sm text-muted-foreground/80">
            管理集团旗下分公司
          </p>
        </div>
        <Button onClick={handleCreate} size="sm" className="h-8 rounded-md text-sm px-3 shadow-sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          新建分公司
        </Button>
      </div>

      {/* Table */}
      <div className="w-full">
        <OrganizationList
          organizations={organizations}
          onEdit={handleEdit}
          onToggleStatus={handleToggleStatus}
        />
      </div>

      {/* Dialog */}
      <OrganizationDialog
        mode={drawerMode}
        defaultValues={selectedOrg ? { name: selectedOrg.name } : undefined}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSubmit={handleDrawerSubmit}
        loading={submitting}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          pendingStatusOrg?.status === "ACTIVE"
            ? `确认禁用「${pendingStatusOrg?.name}」？`
            : `确认启用「${pendingStatusOrg?.name}」？`
        }
        description={confirmDescription}
        confirmLabel={pendingStatusOrg?.status === "ACTIVE" ? "确认禁用" : "确认启用"}
        onConfirm={handleConfirmStatus}
        destructive={pendingStatusOrg?.status === "ACTIVE"}
        loading={submitting}
      />
    </div>
  );
}
