import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TaskEmptyStateProps {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  hint?: string;
  action?: ReactNode;
  tone?: "default" | "muted";
  className?: string;
}

export function TaskEmptyState({
  icon: Icon,
  eyebrow,
  title,
  description,
  hint,
  action,
  tone = "default",
  className,
}: TaskEmptyStateProps) {
  const iconToneClassName =
    tone === "muted"
      ? "border-border/60 bg-background/80 text-muted-foreground"
      : "border-primary/15 bg-primary/10 text-primary";

  return (
    <div
      className={cn(
        "rounded-3xl border border-dashed border-border/70 bg-background/60 px-6 py-6 shadow-sm sm:px-7",
        className,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex max-w-2xl items-start gap-4">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm",
              iconToneClassName,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div className="space-y-2 text-left">
            {eyebrow ? (
              <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">
                {eyebrow}
              </p>
            ) : null}
            <h3 className="text-lg font-semibold tracking-tight text-foreground/95">{title}</h3>
            <p className="text-sm leading-6 text-muted-foreground/80">{description}</p>
          </div>
        </div>

        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>

      {hint ? (
        <div className="mt-4 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 text-sm leading-6 text-muted-foreground/80">
          {hint}
        </div>
      ) : null}
    </div>
  );
}