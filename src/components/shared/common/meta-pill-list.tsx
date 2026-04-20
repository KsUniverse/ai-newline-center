import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  BRAND_PILL_BASE_CLASS_NAME,
  BRAND_PILL_TONE_CLASS_NAMES,
} from "@/components/shared/common/brand";

interface MetaPillItem {
  label: string;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "success";
}

interface MetaPillListProps {
  items: MetaPillItem[];
  className?: string;
}

const TONE_STYLES: Record<NonNullable<MetaPillItem["tone"]>, string> =
  BRAND_PILL_TONE_CLASS_NAMES;

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
              BRAND_PILL_BASE_CLASS_NAME,
              "text-sm",
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
