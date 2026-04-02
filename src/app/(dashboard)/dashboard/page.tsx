import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();
  const userName = session?.user?.name ?? "用户";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">你好，{userName} 👋</h1>
      <p className="mt-2 text-sm text-muted-foreground">欢迎使用 AI Newline Center</p>
      <p className="mt-8 text-xs text-muted-foreground">v0.1.0</p>
    </div>
  );
}
