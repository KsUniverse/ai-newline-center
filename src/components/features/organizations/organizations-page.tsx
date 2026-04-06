"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import type { OrganizationDTO } from "@/types/organization";
import { managementClient } from "@/lib/management-client";
import { ConfirmDialog } from "@/components/shared/common/confirm-dialog";
import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { SurfaceSection } from "@/components/shared/common/surface-section";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { Button } from "@/components/ui/button";

import { OrganizationDialog } from "./organization-dialog";
import { OrganizationList } from "./organization-list";

export function OrganizationsPageView() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const currentUser = session?.user;

  const [organizations, setOrganizations] = useState<OrganizationDTO[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedOrg, setSelectedOrg] = useState<OrganizationDTO | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatusOrg, setPendingStatusOrg] = useState<OrganizationDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
    setDialogMode("create");
    setSelectedOrg(null);
    setDialogOpen(true);
  }

  function handleEdit(org: OrganizationDTO) {
    setDialogMode("edit");
    setSelectedOrg(org);
    setDialogOpen(true);
  }

  function handleToggleStatus(org: OrganizationDTO) {
    setPendingStatusOrg(org);
    setConfirmOpen(true);
  }

  async function refreshOrganizations() {
    const result = await managementClient.listOrganizations();
    setOrganizations(result);
  }

  async function handleDialogSubmit(data: { name: string }) {
    try {
      setSubmitting(true);

      if (dialogMode === "create") {
        await managementClient.createOrganization({ name: data.name });
        toast.success("分公司创建成功");
      } else if (selectedOrg) {
        await managementClient.updateOrganization(selectedOrg.id, { name: data.name });
        toast.success("分公司信息已更新");
      }

      await refreshOrganizations();
      setDialogOpen(false);
      setSelectedOrg(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "组织信息提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmStatus() {
    if (!pendingStatusOrg) {
      return;
    }

    try {
      setSubmitting(true);
      const nextStatus = pendingStatusOrg.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
      const result = await managementClient.setOrganizationStatus(pendingStatusOrg.id, {
        status: nextStatus,
      });

      await refreshOrganizations();

      if (nextStatus === "DISABLED") {
        toast.success(`「${pendingStatusOrg.name}」已禁用，${result.affectedUserCount} 个用户账号已同步禁用`);
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
  const activeCount = organizations.filter((organization) => organization.status === "ACTIVE").length;
  const disabledCount = organizations.length - activeCount;
  const totalUsers = organizations.reduce((count, organization) => count + (organization._count?.users ?? 0), 0);
  const confirmDescription =
    pendingStatusOrg?.status === "ACTIVE"
      ? `该分公司下 ${userCount} 个用户账号将同时被禁用，是否继续？`
      : "启用后分公司下用户账号状态不会自动恢复，需手动单独启用。是否继续？";

  return (
    <DashboardPageShell
      eyebrow="Administration"
      title="组织管理"
      description="维护集团旗下分公司、组织状态与启停策略。"
      maxWidth="wide"
      actions={
        <Button onClick={handleCreate} size="sm" className="h-8 rounded-md px-3 text-sm shadow-sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          新建分公司
        </Button>
      }
    >
      <div className="animate-in-up-d1 w-full">
        <SurfaceSection
          eyebrow="Organization Queue"
          title="分公司档案与启停策略"
          description="统一查看集团下各分公司的状态、账号规模和创建节奏，所有启停动作都在当前列表完成。"
          actions={
            <MetaPillList
              items={[
                { label: `共 ${organizations.length} 个分公司`, tone: "primary" },
                { label: `累计 ${totalUsers} 个账号` },
                { label: `${activeCount} 正常 / ${disabledCount} 禁用`, tone: activeCount > 0 ? "success" : "default" },
              ]}
            />
          }
          bodyClassName="space-y-5"
        >
          <OrganizationList
            organizations={organizations}
            onEdit={handleEdit}
            onToggleStatus={handleToggleStatus}
            loading={loading}
          />
        </SurfaceSection>
      </div>

      <OrganizationDialog
        mode={dialogMode}
        defaultValues={selectedOrg ? { name: selectedOrg.name } : undefined}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleDialogSubmit}
        loading={submitting}
      />

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
    </DashboardPageShell>
  );
}
