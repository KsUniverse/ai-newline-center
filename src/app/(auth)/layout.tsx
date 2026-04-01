import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Atmospheric background layers */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,hsl(173_80%_37%_/_0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_80%_100%,hsl(217_91%_60%_/_0.06),transparent)]" />
        <div className="absolute inset-0 bg-dot-grid opacity-40" />
      </div>

      <div className="relative z-10 w-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
