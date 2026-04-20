import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  BRAND_DIVIDER_CLASS_NAME,
  BRAND_SURFACE_CLASS_NAME,
} from "@/components/shared/common/brand";

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
        BRAND_SURFACE_CLASS_NAME,
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-border/18" />

      <div className={cn("relative border-b px-5 py-5 sm:px-6", BRAND_DIVIDER_CLASS_NAME)}>
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
