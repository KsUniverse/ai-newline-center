import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface MetaPillItem {
  label: string;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "success";
}

interface MetaPillListProps {
  items: MetaPillItem[];
  className?: string;
}

const TONE_STYLES: Record<NonNullable<MetaPillItem["tone"]>, string> = {
  default: "border-border/60 bg-background/80 text-muted-foreground",
  primary: "border-primary/15 bg-primary/8 text-foreground/90",
  success: "border-emerald-500/15 bg-emerald-500/10 text-foreground/90",
};

export function MetaPillList({ items, className }: MetaPillListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {items.map((item) => {
        const Icon = item.icon;
        const tone = item.tone ?? "default";

        return (
          <span
            key={item.label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm shadow-sm",
              TONE_STYLES[tone],
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
            <span>{item.label}</span>
          </span>
        );
      })}
    </div>
  );
}