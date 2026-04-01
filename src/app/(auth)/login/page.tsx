import { LoginForm } from "@/components/features/auth/login-form";

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">AI Newline Center</h1>
        <p className="mt-2 text-sm text-muted-foreground">登录你的账号以继续</p>
      </div>
      <LoginForm />
    </div>
  );
}
