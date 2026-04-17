"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { History, Plus } from "lucide-react";

import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { SurfaceSection } from "@/components/shared/common/surface-section";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { Button } from "@/components/ui/button";

import { ViewpointsAddDialog } from "./viewpoints-add-dialog";
import { ViewpointsTodayList } from "./viewpoints-today-list";

export function ViewpointsTodayPageView() {
  const { data: session } = useSession();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const currentUserId = session?.user?.id ?? "";
  const currentUserRole = session?.user?.role ?? "EMPLOYEE";

  return (
    <DashboardPageShell
      eyebrow="Viewpoints"
      title="今日观点池"
      description="只展示今天新增、今天可引用的观点内容。"
      maxWidth="wide"
      actions={
        <>
          <Button variant="outline" size="sm" className="h-8 rounded-md px-3 text-sm" asChild>
            <Link href="/viewpoints/archived">
              <History className="mr-1.5 h-3.5 w-3.5" />
              历史归档
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-md px-3 text-sm"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            添加观点
          </Button>
        </>
      }
    >
      <MetaPillList
        items={[
          { label: "仅展示今天新增", tone: "primary" },
          { label: "历史内容已归档" },
        ]}
      />

      <SurfaceSection
        eyebrow="Today Signal Pool"
        title="今日观点列表"
        description="快速浏览今天新增观点，并作为当天仿写的引用池。"
      >
        <ViewpointsTodayList
          key={refreshKey}
          scope="today"
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      </SurfaceSection>

      <ViewpointsAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCreated={() => setRefreshKey((current) => current + 1)}
      />
    </DashboardPageShell>
  );
}
