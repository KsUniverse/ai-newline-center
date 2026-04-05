import { auth } from "@/lib/auth";
import { getVisibleNavItems } from "@/components/shared/layout/app-navigation";
import { MetaPillList } from "@/components/shared/common/meta-pill-list";
import { DashboardPageShell } from "@/components/shared/layout/dashboard-page-shell";
import { SurfaceSection } from "@/components/shared/common/surface-section";
import { ArrowUpRight, Building2, LayoutDashboard, Users } from "lucide-react";
import Link from "next/link";

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

  const quickEntryCopy: Record<string, { eyebrow: string; description: string }> = {
    "/accounts": {
      eyebrow: "Content Ops",
      description: "接入账号、处理登录态并查看最近同步的内容样本。",
    },
    "/benchmarks": {
      eyebrow: "Research Ops",
      description: "纳入研究对象、进入档案页并回看归档记录。",
    },
    "/organizations": {
      eyebrow: "Org Ops",
      description: "维护分公司范围、启停状态和组织可用性。",
    },
    "/users": {
      eyebrow: "People Ops",
      description: "创建用户、分配角色并管理账号启停状态。",
    },
  };

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
      <div className="animate-in-up-d1">
        <SurfaceSection
          eyebrow="Quick Entry"
          title="选择一个工作区，继续处理当前任务"
          description="首页只保留任务入口，不再解释系统原理。"
          bodyClassName="space-y-4"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quickEntryItems.map((item) => {
              const Icon = item.icon;
              const copy = quickEntryCopy[item.href] ?? {
                eyebrow: "Workspace",
                description: "进入该模块继续处理当前工作。",
              };

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group rounded-3xl border border-border/60 bg-background/80 p-5 shadow-sm transition-all hover:border-primary/20 hover:bg-card hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-card text-primary shadow-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">
                          {copy.eyebrow}
                        </p>
                        <h3 className="text-base font-semibold tracking-tight text-foreground/95">{item.label}</h3>
                        <p className="text-sm leading-6 text-muted-foreground/80">{copy.description}</p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                </Link>
              );
            })}
          </div>
        </SurfaceSection>
      </div>
    </DashboardPageShell>
  );
}
