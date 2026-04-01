import { LoginForm } from "@/components/features/auth/login-form";

export default function LoginPage() {
  return (
    <div className="animate-in-up w-full max-w-sm">
      {/* Brand mark */}
      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground text-base font-bold shadow-lg shadow-primary/30 ring-1 ring-primary/20">
          AI
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">AI Newline Center</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">登录你的账号以继续</p>
        </div>
      </div>
      <LoginForm />
    </div>
  );
}
