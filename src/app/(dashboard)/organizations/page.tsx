"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import type { OrganizationDTO } from "@/types/organization";
import { OrganizationList } from "@/components/features/organizations/organization-list";
import { OrganizationDialog } from "@/components/features/organizations/organization-dialog";
import { ConfirmDialog } from "@/components/shared/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { managementClient } from "@/lib/management-client";

export default function OrganizationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const currentUser = session?.user;

  const [organizations, setOrganizations] = useState<OrganizationDTO[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [selectedOrg, setSelectedOrg] = useState<OrganizationDTO | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatusOrg, setPendingStatusOrg] = useState<OrganizationDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Client-side permission guard
  const redirected = useRef(false);
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "SUPER_ADMIN" && !redirected.current) {
      redirected.current = true;
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated" || currentUser?.role !== "SUPER_ADMIN") {
      return;
    }

    async function loadOrganizations() {
      try {
        setLoading(true);
        const result = await managementClient.listOrganizations();
        setOrganizations(result);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "组织列表加载失败");
      } finally {
        setLoading(false);
      }
    }

    void loadOrganizations();
  }, [currentUser?.role, status]);

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

  async function refreshOrganizations() {
    const result = await managementClient.listOrganizations();
    setOrganizations(result);
  }

  async function handleDrawerSubmit(data: { name: string }) {
    try {
      setSubmitting(true);

      if (drawerMode === "create") {
        await managementClient.createOrganization({ name: data.name });
        toast.success("分公司创建成功");
      } else if (selectedOrg) {
        await managementClient.updateOrganization(selectedOrg.id, { name: data.name });
        toast.success("分公司信息已更新");
      }

      await refreshOrganizations();
      setDrawerOpen(false);
      setSelectedOrg(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "组织信息提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmStatus() {
    if (!pendingStatusOrg) return;

    try {
      setSubmitting(true);

      const nextStatus = pendingStatusOrg.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
      const result = await managementClient.setOrganizationStatus(pendingStatusOrg.id, {
        status: nextStatus,
      });

      await refreshOrganizations();

      if (nextStatus === "DISABLED") {
        toast.success(
          `「${pendingStatusOrg.name}」已禁用，${result.affectedUserCount} 个用户账号已同步禁用`,
        );
      } else {
        toast.success(`「${pendingStatusOrg.name}」已启用`);
      }

      setConfirmOpen(false);
      setPendingStatusOrg(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "组织状态更新失败");
    } finally {
      setSubmitting(false);
    }
  }

  const userCount = pendingStatusOrg?._count?.users ?? 0;
  const confirmDescription =
    pendingStatusOrg?.status === "ACTIVE"
      ? `该分公司下 ${userCount} 个用户账号将同时被禁用，是否继续？`
      : `启用后分公司下用户账号状态不会自动恢复，需手动单独启用。是否继续？`;

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="animate-in-up flex items-center justify-between">
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
      <div className="animate-in-up-d1 w-full">
        <OrganizationList
          organizations={organizations}
          onEdit={handleEdit}
          onToggleStatus={handleToggleStatus}
          loading={loading}
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
