"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import type { OrganizationDTO } from "@/types/organization";
import type { UserDTO } from "@/types/user-management";
import { UserList } from "@/components/features/users/user-list";
import { UserDialog, type CreateUserData, type UpdateUserData } from "@/components/features/users/user-dialog";
import { ConfirmDialog } from "@/components/shared/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { managementClient } from "@/lib/management-client";

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const currentUser = session?.user;

  const [users, setUsers] = useState<UserDTO[]>([]);
  const [organizations, setOrganizations] = useState<Pick<OrganizationDTO, "id" | "name">[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<UserDTO | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatusUser, setPendingStatusUser] = useState<UserDTO | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const callerRole = currentUser?.role ?? "EMPLOYEE";
  const isSuperAdmin = callerRole === "SUPER_ADMIN";

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
        setOrganizations([
          {
            id: self.organization.id,
            name: self.organization.name,
          },
        ]);
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
    setDrawerMode("create");
    setSelectedUser(null);
    setDrawerOpen(true);
  }

  function handleEdit(user: UserDTO) {
    setDrawerMode("edit");
    setSelectedUser(user);
    setDrawerOpen(true);
  }

  function handleToggleStatus(user: UserDTO) {
    if (user.id === session?.user?.id) {
      toast.error("不能禁用当前登录账号");
      return;
    }
    setPendingStatusUser(user);
    setConfirmOpen(true);
  }

  async function handleDrawerSubmit(data: CreateUserData | UpdateUserData) {
    try {
      setSubmitting(true);

      if (drawerMode === "create") {
        await managementClient.createUser(data as CreateUserData);
        toast.success("用户创建成功");
      } else if (selectedUser) {
        await managementClient.updateUser(selectedUser.id, data as UpdateUserData);
        toast.success("用户信息已更新");
      }

      await refreshUsers(isSuperAdmin ? selectedOrgId || undefined : undefined);
      setDrawerOpen(false);
      setSelectedUser(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "用户信息提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmStatus() {
    if (!pendingStatusUser) return;

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
    <div className="flex flex-1 flex-col gap-6 px-8 py-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="animate-in-up flex items-center justify-between">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight leading-none text-foreground/90">用户管理</h1>
          <p className="text-sm text-muted-foreground/80">
            {isSuperAdmin ? "管理所有用户账号" : "管理本公司用户账号"}
          </p>
        </div>
        <Button onClick={handleCreate} size="sm" className="h-8 rounded-md text-sm px-3 shadow-sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          新建用户
        </Button>
      </div>

      {/* Table */}
      <div className="animate-in-up-d1 w-full">
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
      </div>

      {/* Dialog */}
      <UserDialog
        mode={drawerMode}
        defaultValues={selectedUser ?? undefined}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSubmit={handleDrawerSubmit}
        loading={submitting}
        organizations={organizations}
        callerRole={callerRole as "SUPER_ADMIN" | "BRANCH_MANAGER" | "EMPLOYEE"}
      />

      {/* Confirm Dialog */}
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
    </div>
  );
}