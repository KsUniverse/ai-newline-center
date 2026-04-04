"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg";
}

const widthMap = { sm: "w-[400px]", md: "w-[560px]", lg: "w-[720px]" };

export function SlidePanel({
  open,
  onClose,
  title,
  children,
  width = "md",
}: SlidePanelProps) {
  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-50 border-l border-border bg-background shadow-lg",
        "transition-transform duration-300 ease-in-out",
        widthMap[width],
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </div>
    </div>
  );
}
