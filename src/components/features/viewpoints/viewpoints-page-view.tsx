"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";

import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { Button } from "@/components/ui/button";

import { ViewpointsAddDialog } from "./viewpoints-add-dialog";
import { ViewpointsList } from "./viewpoints-list";

export function ViewpointsPageView() {
  const { data: session } = useSession();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const currentUserId = session?.user?.id ?? "";
  const currentUserRole = session?.user?.role ?? "EMPLOYEE";

  return (
    <DashboardPageShell
      eyebrow="Viewpoints"
      title="观点库"
      description="全公司共享的碎片观点，支持录入与搜索引用"
      actions={
        <Button type="button" onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          添加观点
        </Button>
      }
    >
      <ViewpointsList
        key={refreshKey}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
      />

      <ViewpointsAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </DashboardPageShell>
  );
}
