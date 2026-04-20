"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  BRAND_DIVIDER_CLASS_NAME,
  BRAND_OVERLAY_SURFACE_CLASS_NAME,
} from "@/components/shared/common/brand";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: "sm" | "md" | "lg";
}

const widthMap = {
  sm: "w-full sm:w-[400px]",
  md: "w-full sm:w-[560px]",
  lg: "w-full sm:w-[720px]",
};

export function SlidePanel({
  open,
  onClose,
  title,
  children,
  width = "md",
}: SlidePanelProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        className={cn(
          "h-full p-0 [&>button]:hidden",
          BRAND_OVERLAY_SURFACE_CLASS_NAME,
          widthMap[width],
        )}
      >
        <div className="flex h-full flex-col">
          <SheetHeader className={cn("border-b px-5 py-4 text-left sm:px-6", BRAND_DIVIDER_CLASS_NAME)}>
            <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
              研究详情
            </p>
            <SheetTitle className="text-lg font-semibold tracking-tight text-foreground/90">
              {title}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-auto p-5 sm:p-6">{children}</div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
