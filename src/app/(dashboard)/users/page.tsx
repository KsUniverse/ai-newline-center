"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { apiClient, ApiError } from "@/lib/api-client";

interface UsersResponse {
  items: UserDTO[];
  total: number;
  page: number;
  limit: number;
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

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

  const callerRole = session?.user?.role ?? "EMPLOYEE";
  const isSuperAdmin = callerRole === "SUPER_ADMIN";

  // Filter users by org for BRANCH_MANAGER; for SUPER_ADMIN apply the selectedOrgId filter
  const filteredUsers = useMemo(() => {
    if (!isSuperAdmin) {
      return users.filter((u) => u.organizationId === session?.user?.organizationId);
    }
    if (selectedOrgId) {
      return users.filter((u) => u.organizationId === selectedOrgId);
    }
    return users;
  }, [users, isSuperAdmin, selectedOrgId, session?.user?.organizationId]);

  // Available orgs for drawer (SUPER_ADMIN: all branches; BRANCH_MANAGER: own org only)
  const drawerOrgs: Pick<OrganizationDTO, "id" | "name">[] = useMemo(
    () =>
      isSuperAdmin
        ? organizations
        : organizations.filter((o) => o.id === session?.user?.organizationId),
    [isSuperAdmin, organizations, session?.user?.organizationId],
  );

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

  useEffect(() => {
    if (
      status !== "authenticated" ||
      (session?.user?.role !== "SUPER_ADMIN" && session?.user?.role !== "BRANCH_MANAGER")
    ) {
      if (status !== "loading") {
        setLoading(false);
      }
      return;
    }

    let cancelled = false;

    async function loadUsers() {
      try {
        setLoading(true);
        const query = new URLSearchParams({
          page: "1",
          limit: "20",
          ...(isSuperAdmin && selectedOrgId ? { organizationId: selectedOrgId } : {}),
        });
        const result = await apiClient.get<UsersResponse>(`/users?${query.toString()}`);
        if (!cancelled) {
          setUsers(result.items);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof ApiError ? error.message : "加载用户数据失败，请稍后重试";
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, selectedOrgId, session?.user?.role, status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    async function loadOrganizations() {
      try {
        if (isSuperAdmin) {
          const result = await apiClient.get<OrganizationDTO[]>("/organizations");
          if (!cancelled) {
            setOrganizations(result.map((org) => ({ id: org.id, name: org.name })));
          }
        } else if (session?.user?.organizationId) {
          const result = await apiClient.get<OrganizationDTO>(
            `/organizations/${session.user.organizationId}`,
          );
          if (!cancelled) {
            setOrganizations([{ id: result.id, name: result.name }]);
          }
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof ApiError ? error.message : "加载组织数据失败，请稍后重试";
          toast.error(message);
        }
      }
    }

    void loadOrganizations();

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, session?.user?.organizationId, status]);

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
        const newUser = await apiClient.post<UserDTO>("/users", data);
        setUsers((prev) => [newUser, ...prev]);
        toast.success("用户创建成功");
      } else if (selectedUser) {
        const updatedUser = await apiClient.put<UserDTO>(`/users/${selectedUser.id}`, data);
        setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? updatedUser : u)));
        toast.success("用户信息已更新");
      }
      setDrawerOpen(false);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "提交失败，请稍后重试";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmStatus() {
    if (!pendingStatusUser) return;
    try {
      setSubmitting(true);
      const nextStatus = pendingStatusUser.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
      const updatedUser = await apiClient.patch<UserDTO>(`/users/${pendingStatusUser.id}/status`, {
        status: nextStatus,
      });
      setUsers((prev) => prev.map((u) => (u.id === pendingStatusUser.id ? updatedUser : u)));
      const label = nextStatus === "DISABLED" ? "已禁用" : "已启用";
      toast.success(`「${pendingStatusUser.name}」${label}`);
      setConfirmOpen(false);
      setPendingStatusUser(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "状态更新失败，请稍后重试";
      toast.error(message);
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
          users={filteredUsers}
          onEdit={handleEdit}
          onToggleStatus={handleToggleStatus}
          organizations={isSuperAdmin ? organizations : undefined}
          showOrgFilter={isSuperAdmin}
          selectedOrgId={selectedOrgId}
          onOrgFilterChange={setSelectedOrgId}
          loading={loading}
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
        organizations={drawerOrgs}
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
