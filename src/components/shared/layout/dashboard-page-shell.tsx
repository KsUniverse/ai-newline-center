import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const maxWidthClassName = {
  default: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
} as const;

interface DashboardPageShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  maxWidth?: keyof typeof maxWidthClassName;
  surfaceHeader?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function DashboardPageShell({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel,
  maxWidth = "default",
  surfaceHeader = false,
  className,
  bodyClassName,
  children,
}: DashboardPageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8",
        maxWidthClassName[maxWidth],
        className,
      )}
    >
      <div
        className={cn(
          "animate-in-up flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between",
          surfaceHeader && "rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm supports-backdrop-filter:bg-card/70",
        )}
      >
        <div className="space-y-1.5">
          {backHref && (
            <Link
              href={backHref}
              className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:border-primary/20 hover:bg-card hover:text-foreground"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-muted-foreground">
                <ChevronLeft className="h-3.5 w-3.5" />
              </span>
              {backLabel ?? "返回"}
            </Link>
          )}
          {eyebrow ? (
            <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-xl font-semibold tracking-tight leading-none text-foreground/90">
            {title}
          </h1>
          {description && <p className="text-sm leading-6 text-muted-foreground/80">{description}</p>}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <div className={cn("space-y-6", bodyClassName)}>{children}</div>
    </div>
  );
}
