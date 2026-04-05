import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SurfaceSectionProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function SurfaceSection({
  eyebrow,
  title,
  description,
  actions,
  className,
  bodyClassName,
  children,
}: SurfaceSectionProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/60 bg-card/90 shadow-sm",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.12),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.12]" />

      <div className="relative border-b border-border/60 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            {eyebrow ? (
              <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
                {eyebrow}
              </p>
            ) : null}
            <h2 className="text-lg font-semibold tracking-tight text-foreground/95">{title}</h2>
            {description ? (
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground/80">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>

      <div className={cn("relative px-5 py-5 sm:px-6", bodyClassName)}>{children}</div>
    </section>
  );
}