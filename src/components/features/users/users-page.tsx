"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import type { OrganizationDTO } from "@/types/organization";
import type { UserDTO } from "@/types/user-management";
import { managementClient } from "@/lib/management-client";
import { ConfirmDialog } from "@/components/shared/common/confirm-dialog";
import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { managementCompactActionClassName } from "@/components/shared/common/management-primitives";
import { SurfaceSection } from "@/components/shared/common/surface-section";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { Button } from "@/components/ui/button";

import { UserDialog, type CreateUserData, type UpdateUserData } from "./user-dialog";
import { UserList } from "./user-list";

export function UsersPageView() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const currentUser = session?.user;

  const [users, setUsers] = useState<UserDTO[]>([]);
  const [organizations, setOrganizations] = useState<Pick<OrganizationDTO, "id" | "name">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<UserDTO | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatusUser, setPendingStatusUser] = useState<UserDTO | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const callerRole = currentUser?.role ?? "EMPLOYEE";
  const isSuperAdmin = callerRole === "SUPER_ADMIN";
  const activeCount = users.filter((user) => user.status === "ACTIVE").length;
  const disabledCount = users.length - activeCount;
  const selectedOrganizationName = selectedOrgId
    ? organizations.find((organization) => organization.id === selectedOrgId)?.name ?? "已筛选分公司"
    : isSuperAdmin
      ? "全部分公司"
      : organizations[0]?.name ?? "当前分公司";

  const redirected = useRef(false);
  useEffect(() => {
    if (
      status === "authenticated" &&
      session?.user?.role !== "SUPER_ADMIN" &&
      session?.user?.role !== "BRANCH_MANAGER" &&
      !redirected.current
    ) {
      redirected.current = true;
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  async function refreshUsers(organizationId?: string) {
    const result = await managementClient.listUsers({
      page: 1,
      limit: 20,
      organizationId,
    });

    setUsers(result.items);
  }

  useEffect(() => {
    if (
      status !== "authenticated" ||
      (currentUser?.role !== "SUPER_ADMIN" && currentUser?.role !== "BRANCH_MANAGER")
    ) {
      return;
    }

    async function loadInitialData() {
      try {
        setLoading(true);

        if (currentUser?.role === "SUPER_ADMIN") {
          const [userResult, orgResult] = await Promise.all([
            managementClient.listUsers({
              page: 1,
              limit: 20,
              organizationId: selectedOrgId || undefined,
            }),
            managementClient.listOrganizations(),
          ]);

          setUsers(userResult.items);
          setOrganizations(orgResult.map((org) => ({ id: org.id, name: org.name })));
          return;
        }

        const [userResult, self] = await Promise.all([
          managementClient.listUsers({ page: 1, limit: 20 }),
          managementClient.getUser(currentUser?.id ?? ""),
        ]);

        setUsers(userResult.items);
        setOrganizations([{ id: self.organization.id, name: self.organization.name }]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "用户列表加载失败");
      } finally {
        setLoading(false);
      }
    }

    void loadInitialData();
  }, [currentUser?.id, currentUser?.role, selectedOrgId, status]);

  if (
    status === "loading" ||
    (status === "authenticated" &&
      session?.user?.role !== "SUPER_ADMIN" &&
      session?.user?.role !== "BRANCH_MANAGER")
  ) {
    return null;
  }

  function handleCreate() {
    setDialogMode("create");
    setSelectedUser(null);
    setDialogOpen(true);
  }

  function handleEdit(user: UserDTO) {
    setDialogMode("edit");
    setSelectedUser(user);
    setDialogOpen(true);
  }

  function handleToggleStatus(user: UserDTO) {
    if (user.id === session?.user?.id) {
      toast.error("不能禁用当前登录账号");
      return;
    }

    setPendingStatusUser(user);
    setConfirmOpen(true);
  }

  async function handleDialogSubmit(data: CreateUserData | UpdateUserData) {
    try {
      setSubmitting(true);

      if (dialogMode === "create") {
        await managementClient.createUser(data as CreateUserData);
        toast.success("用户创建成功");
      } else if (selectedUser) {
        await managementClient.updateUser(selectedUser.id, data as UpdateUserData);
        toast.success("用户信息已更新");
      }

      await refreshUsers(isSuperAdmin ? selectedOrgId || undefined : undefined);
      setDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "用户信息提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmStatus() {
    if (!pendingStatusUser) {
      return;
    }

    try {
      setSubmitting(true);
      const nextStatus = pendingStatusUser.status === "ACTIVE" ? "DISABLED" : "ACTIVE";

      await managementClient.setUserStatus(pendingStatusUser.id, {
        status: nextStatus,
      });

      await refreshUsers(isSuperAdmin ? selectedOrgId || undefined : undefined);
      toast.success(`「${pendingStatusUser.name}」${nextStatus === "DISABLED" ? "已禁用" : "已启用"}`);
      setConfirmOpen(false);
      setPendingStatusUser(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "用户状态更新失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardPageShell
      eyebrow="Administration"
      title="用户管理"
      description={
        isSuperAdmin
          ? "统一维护全平台用户账号、组织归属和启停状态。"
          : "维护本公司用户账号、角色和启停状态。"
      }
      maxWidth="wide"
      actions={
        <Button onClick={handleCreate} size="sm" className={managementCompactActionClassName}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          新建用户
        </Button>
      }
    >
      <div className="animate-in-up-d1 w-full">
        <SurfaceSection
          eyebrow="User Queue"
          title="账号、角色与组织归属"
          description="在当前列表直接完成用户档案维护、角色分配和启停动作，桌面表格与移动卡片共用一套状态语言。"
          actions={
            <MetaPillList
              items={[
                { label: `共 ${users.length} 个账号`, tone: "primary" },
                { label: `${activeCount} 个正常`, tone: "success" },
                { label: `${disabledCount} 个已禁用` },
                { label: selectedOrganizationName },
              ]}
            />
          }
          bodyClassName="space-y-5"
        >
          <UserList
            users={users}
            onEdit={handleEdit}
            onToggleStatus={handleToggleStatus}
            organizations={isSuperAdmin ? organizations : undefined}
            showOrgFilter={isSuperAdmin}
            selectedOrgId={selectedOrgId}
            onOrgFilterChange={setSelectedOrgId}
            loading={loading}
            currentUserId={currentUser?.id}
          />
        </SurfaceSection>
      </div>

      <UserDialog
        mode={dialogMode}
        defaultValues={selectedUser ?? undefined}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleDialogSubmit}
        loading={submitting}
        organizations={organizations}
        callerRole={callerRole as "SUPER_ADMIN" | "BRANCH_MANAGER" | "EMPLOYEE"}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          pendingStatusUser?.status === "ACTIVE"
            ? `确认禁用「${pendingStatusUser?.name}」？`
            : `确认启用「${pendingStatusUser?.name}」？`
        }
        description={
          pendingStatusUser?.status === "ACTIVE"
            ? "禁用后该用户将无法登录，是否继续？"
            : "启用后该用户可重新登录，是否继续？"
        }
        confirmLabel={pendingStatusUser?.status === "ACTIVE" ? "确认禁用" : "确认启用"}
        onConfirm={handleConfirmStatus}
        destructive={pendingStatusUser?.status === "ACTIVE"}
        loading={submitting}
      />
    </DashboardPageShell>
  );
}
