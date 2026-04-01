import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <p className="text-7xl font-bold text-muted-foreground/30">404</p>
      <h1 className="text-xl font-semibold">页面不存在</h1>
      <p className="text-sm text-muted-foreground">你访问的页面不存在或已被移除</p>
      <Link
        href="/"
        className="mt-2 text-sm text-primary underline-offset-4 hover:underline"
      >
        返回首页
      </Link>
    </div>
  );
}
