"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import type { OrganizationDTO } from "@/types/organization";
import type { UserDTO } from "@/types/user-management";
import { mockUsers } from "@/components/features/users/__mocks__/users";
import { mockOrganizations } from "@/components/features/organizations/__mocks__/organizations";
import { UserList } from "@/components/features/users/user-list";
import { UserDialog, type CreateUserData, type UpdateUserData } from "@/components/features/users/user-dialog";
import { ConfirmDialog } from "@/components/shared/common/confirm-dialog";
import { Button } from "@/components/ui/button";

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<UserDTO[]>(mockUsers);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<UserDTO | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatusUser, setPendingStatusUser] = useState<UserDTO | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState("");
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
        ? mockOrganizations
        : mockOrganizations.filter((o) => o.id === session?.user?.organizationId),
    [isSuperAdmin, session?.user?.organizationId],
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

  function handleDrawerSubmit(data: CreateUserData | UpdateUserData) {
    setSubmitting(true);
    setTimeout(() => {
      if (drawerMode === "create") {
        const createData = data as CreateUserData;
        const org =
          mockOrganizations.find((o) => o.id === createData.organizationId) ??
          { id: createData.organizationId, name: createData.organizationId };
        const newUser: UserDTO = {
          id: `user_${Date.now()}`,
          account: createData.account,
          name: createData.name,
          role: createData.role,
          status: "ACTIVE",
          organizationId: createData.organizationId,
          organization: { id: org.id, name: org.name },
          createdAt: new Date().toISOString(),
        };
        setUsers((prev) => [...prev, newUser]);
        toast.success("用户创建成功");
      } else if (selectedUser) {
        const updateData = data as UpdateUserData;
        setUsers((prev) =>
          prev.map((u) =>
            u.id === selectedUser.id
              ? { ...u, name: updateData.name, role: updateData.role }
              : u,
          ),
        );
        toast.success("用户信息已更新");
      }
      setDrawerOpen(false);
      setSubmitting(false);
    }, 500);
  }

  function handleConfirmStatus() {
    if (!pendingStatusUser) return;
    setSubmitting(true);
    setTimeout(() => {
      const nextStatus = pendingStatusUser.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
      setUsers((prev) =>
        prev.map((u) =>
          u.id === pendingStatusUser.id ? { ...u, status: nextStatus } : u,
        ),
      );
      const label = nextStatus === "DISABLED" ? "已禁用" : "已启用";
      toast.success(`「${pendingStatusUser.name}」${label}`);
      setConfirmOpen(false);
      setPendingStatusUser(null);
      setSubmitting(false);
    }, 500);
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
          organizations={isSuperAdmin ? mockOrganizations : undefined}
          showOrgFilter={isSuperAdmin}
          selectedOrgId={selectedOrgId}
          onOrgFilterChange={setSelectedOrgId}
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
