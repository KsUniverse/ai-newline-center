import type { ReactNode } from "react";

interface DashboardPageShellProps {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function DashboardPageShell({
  title,
  description,
  actions,
  children,
}: DashboardPageShellProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-6 max-w-6xl mx-auto w-full">
      <div className="animate-in-up flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight leading-none text-foreground/90">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground/80">{description}</p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      {children}
    </div>
  );
}
