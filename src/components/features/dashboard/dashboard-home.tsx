import { auth } from "@/lib/auth";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "超级管理员",
  BRANCH_MANAGER: "分公司负责人",
  EMPLOYEE: "员工",
};

export async function DashboardHome() {
  const session = await auth();
  const userName = session?.user?.name ?? "用户";
  const roleLabel = ROLE_LABEL[session?.user?.role ?? ""] ?? "未知角色";

  return (
    <div className="flex flex-1 flex-col gap-8 px-8 py-8 max-w-6xl mx-auto w-full">
      <div className="animate-in-up space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">你好，{userName}</h1>
        <p className="text-sm text-muted-foreground">欢迎使用 AI Newline Center</p>
      </div>

      <div className="animate-in-up-d1 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-card p-5">
          <p className="text-sm text-muted-foreground">系统版本</p>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground/90">
            v0.1.0
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-5">
          <p className="text-sm text-muted-foreground">系统状态</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            <span className="text-sm font-medium">运行正常</span>
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-5">
          <p className="text-sm text-muted-foreground">当前角色</p>
          <p className="mt-2 text-sm font-medium">{roleLabel}</p>
        </div>
      </div>

      <div className="animate-in-up-d2 rounded-lg border border-border/60 bg-card p-6">
        <h2 className="mb-1 text-base font-medium">快速开始</h2>
        <p className="text-sm text-muted-foreground">
          通过左侧导航访问组织管理、用户管理等功能模块。
        </p>
      </div>
    </div>
  );
}
