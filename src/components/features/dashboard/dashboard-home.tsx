import { auth } from "@/lib/auth";
import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { getVisibleNavItems } from "@/components/shared/layout/app-navigation";
import { Building2, LayoutDashboard, Users } from "lucide-react";
import { DashboardVideoSection } from "./dashboard-video-section";
import { DashboardBannedSection } from "./dashboard-banned-section";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "超级管理员",
  BRANCH_MANAGER: "分公司负责人",
  EMPLOYEE: "员工",
};

export async function DashboardHome() {
  const session = await auth();
  const userName = session?.user?.name ?? "用户";
  const roleLabel = ROLE_LABEL[session?.user?.role ?? ""] ?? "未知角色";
  const quickEntryItems = getVisibleNavItems(session?.user?.role).filter((item) => item.href !== "/dashboard");

  return (
    <DashboardPageShell
      eyebrow="Control Center"
      title={`你好，${userName}`}
      description="直接进入你今天要处理的工作区。"
      maxWidth="wide"
      actions={
        <MetaPillList
          items={[
            { label: roleLabel, icon: Users, tone: "default" },
            { label: `${quickEntryItems.length} 个工作区`, icon: LayoutDashboard, tone: "primary" },
            { label: "系统正常", icon: Building2, tone: "success" },
          ]}
        />
      }
    >
      <div className="animate-in-up-d2 mt-6 space-y-6">
        <DashboardVideoSection />
        <DashboardBannedSection />
      </div>
    </DashboardPageShell>
  );
}
