import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  BRAND_COMPACT_ACTION_CLASS_NAME,
  BRAND_EYEBROW_CLASS_NAME,
  BRAND_FIELD_ICON_SHELL_CLASS_NAME,
  BRAND_FIELD_SHELL_CLASS_NAME,
  BRAND_FORM_SECTION_CLASS_NAME,
  BRAND_HEADER_ICON_SHELL_CLASS_NAME,
  BRAND_INSET_SURFACE_CLASS_NAME,
  BRAND_METRIC_CARD_CLASS_NAME,
  BRAND_MOBILE_CARD_CLASS_NAME,
  BRAND_NOTE_SURFACE_CLASS_NAME,
  BRAND_STATUS_PILL_CLASS_NAME,
  BRAND_TABLE_WRAPPER_CLASS_NAME,
} from "./brand";

interface ManagementPanelHeadingProps {
  icon: LucideIcon;
  title: string;
  description: string;
  eyebrow?: string;
}

export function ManagementPanelHeading({
  icon: Icon,
  title,
  description,
  eyebrow = "Administration",
}: ManagementPanelHeadingProps) {
  return (
    <div className="flex items-start gap-3">
      <div className={BRAND_HEADER_ICON_SHELL_CLASS_NAME}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 space-y-1.5">
        <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">{eyebrow}</p>
        <div className="text-lg font-semibold tracking-tight text-foreground/95">{title}</div>
        <p className="text-sm leading-6 text-muted-foreground/80">{description}</p>
      </div>
    </div>
  );
}

interface ManagementFormSectionProps {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
}

export function ManagementFormSection({
  icon: Icon,
  title,
  children,
  className,
  titleClassName,
}: ManagementFormSectionProps) {
  return (
    <div className={cn(BRAND_FORM_SECTION_CLASS_NAME, className)}>
      <div className="flex items-center gap-2 text-primary">
        <Icon className="h-4 w-4" />
        <p className={cn(BRAND_EYEBROW_CLASS_NAME, titleClassName)}>{title}</p>
      </div>
      {children}
    </div>
  );
}

interface ManagementFieldShellProps {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
  iconClassName?: string;
}

export function ManagementFieldShell({
  icon: Icon,
  children,
  className,
  iconClassName,
}: ManagementFieldShellProps) {
  return (
    <div className={cn(BRAND_FIELD_SHELL_CLASS_NAME, className)}>
      <span className={cn(BRAND_FIELD_ICON_SHELL_CLASS_NAME, iconClassName)}>
        <Icon className="h-4 w-4" />
      </span>
      {children}
    </div>
  );
}

interface ManagementNoteProps {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
}

export function ManagementNote({ icon: Icon, title, children, className }: ManagementNoteProps) {
  return (
    <div className={cn(BRAND_NOTE_SURFACE_CLASS_NAME, className)}>
      <div className="flex items-center gap-2 text-primary">
        <Icon className="h-4 w-4" />
        <p className={BRAND_EYEBROW_CLASS_NAME}>{title}</p>
      </div>
      <div className="mt-2 text-sm leading-6 text-muted-foreground/80">{children}</div>
    </div>
  );
}

interface ManagementMetricCardProps {
  label: string;
  value: ReactNode;
  description: string;
  className?: string;
}

export function ManagementMetricCard({
  label,
  value,
  description,
  className,
}: ManagementMetricCardProps) {
  return (
    <div className={cn(BRAND_METRIC_CARD_CLASS_NAME, className)}>
      <p className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground/95">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground/80">{description}</p>
    </div>
  );
}

interface ManagementSidecarProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
}

export function ManagementSidecar({
  icon: Icon,
  title,
  description,
  children,
  className,
}: ManagementSidecarProps) {
  return (
    <div className={cn(BRAND_METRIC_CARD_CLASS_NAME, "px-4 py-3", className)}>
      <div className="flex items-center gap-2 text-primary">
        <Icon className="h-4 w-4" />
        <p className={BRAND_EYEBROW_CLASS_NAME}>{title}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground/80">{description}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

interface StatusPillProps {
  dotClassName: string;
  label: string;
  className?: string;
}

export function StatusPill({ dotClassName, label, className }: StatusPillProps) {
  return (
    <div className={cn(BRAND_STATUS_PILL_CLASS_NAME, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClassName)} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export const managementCompactActionClassName = BRAND_COMPACT_ACTION_CLASS_NAME;
export const managementInsetSurfaceClassName = BRAND_INSET_SURFACE_CLASS_NAME;
export const managementMobileCardClassName = BRAND_MOBILE_CARD_CLASS_NAME;
export const managementTableWrapperClassName = BRAND_TABLE_WRAPPER_CLASS_NAME;
