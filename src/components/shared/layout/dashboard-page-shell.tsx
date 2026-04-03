import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

interface DashboardPageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}

export function DashboardPageShell({
  title,
  description,
  actions,
  backHref,
  backLabel,
  children,
}: DashboardPageShellProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-6 max-w-6xl mx-auto w-full">
      <div className="animate-in-up flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {backLabel ?? "返回"}
            </Link>
          )}
          <h1 className="text-xl font-semibold tracking-tight leading-none text-foreground/90">
            {title}
          </h1>
          {description && <p className="text-sm text-muted-foreground/80">{description}</p>}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      {children}
    </div>
  );
}
