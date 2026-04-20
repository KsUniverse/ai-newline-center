export const BRAND_OUTER_PANEL_BORDER_CLASS_NAME = "border-border/55";

export const BRAND_INSET_BORDER_CLASS_NAME = "border-border/45";

export const BRAND_DIVIDER_CLASS_NAME = "border-border/28";

export const BRAND_OVERLAY_SURFACE_CLASS_NAME =
  `rounded-xl border ${BRAND_OUTER_PANEL_BORDER_CLASS_NAME} bg-card shadow-[0_18px_44px_-32px_rgba(15,23,42,0.42)]`;

export const BRAND_SURFACE_CLASS_NAME =
  `relative overflow-hidden rounded-xl border ${BRAND_OUTER_PANEL_BORDER_CLASS_NAME} bg-card`;

export const BRAND_WORKSPACE_PANEL_CLASS_NAME =
  `rounded-xl border ${BRAND_OUTER_PANEL_BORDER_CLASS_NAME} bg-card/95`;

export const BRAND_PILL_BASE_CLASS_NAME =
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs";

export const BRAND_PILL_TONE_CLASS_NAMES = {
  default: `${BRAND_INSET_BORDER_CLASS_NAME} bg-background/80 text-muted-foreground`,
  primary: "border-primary/14 bg-primary/8 text-foreground/90",
  success: "border-emerald-500/14 bg-emerald-500/10 text-foreground/90",
} as const;

export const BRAND_INSET_SURFACE_CLASS_NAME =
  `rounded-lg border ${BRAND_INSET_BORDER_CLASS_NAME} bg-background`;

export const BRAND_FORM_SECTION_CLASS_NAME =
  `grid gap-4 rounded-xl border ${BRAND_INSET_BORDER_CLASS_NAME} bg-background p-4 sm:p-5`;

export const BRAND_FORM_SECTION_GRID_CLASS_NAME = `${BRAND_FORM_SECTION_CLASS_NAME} sm:grid-cols-2`;

export const BRAND_NOTE_SURFACE_CLASS_NAME =
  `rounded-xl border ${BRAND_INSET_BORDER_CLASS_NAME} bg-background px-4 py-4`;

export const BRAND_FIELD_SHELL_CLASS_NAME =
  `flex items-center gap-3 rounded-lg border ${BRAND_INSET_BORDER_CLASS_NAME} bg-card px-3 py-2.5`;

export const BRAND_HEADER_ICON_SHELL_CLASS_NAME =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/14 bg-primary/8 text-primary";

export const BRAND_FIELD_ICON_SHELL_CLASS_NAME =
  "flex h-9 w-9 items-center justify-center rounded-md border border-border/50 bg-background text-primary";

export const BRAND_METRIC_CARD_CLASS_NAME =
  `rounded-lg border ${BRAND_INSET_BORDER_CLASS_NAME} bg-background p-4`;

export const BRAND_TABLE_WRAPPER_CLASS_NAME =
  `hidden overflow-hidden rounded-xl border ${BRAND_OUTER_PANEL_BORDER_CLASS_NAME} bg-background md:block`;

export const BRAND_MOBILE_CARD_CLASS_NAME =
  `rounded-xl border ${BRAND_INSET_BORDER_CLASS_NAME} bg-background p-4`;

export const BRAND_STATUS_PILL_CLASS_NAME =
  `${BRAND_PILL_BASE_CLASS_NAME} border-border/45 bg-background`;

export const BRAND_COMPACT_ACTION_CLASS_NAME =
  `h-8 rounded-md border ${BRAND_INSET_BORDER_CLASS_NAME} px-3 text-sm`;

export const BRAND_EYEBROW_CLASS_NAME =
  "text-2xs font-medium uppercase tracking-[0.18em] text-primary/85";

export function getBrandNavItemClassName(active: boolean) {
  return active
    ? `group flex items-center gap-3 rounded-xl border ${BRAND_OUTER_PANEL_BORDER_CLASS_NAME} bg-accent/45 px-3 py-3 text-sm text-foreground transition-colors`
    : "group flex items-center gap-3 rounded-xl border border-transparent bg-transparent px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-border/45 hover:bg-accent/55 hover:text-foreground";
}

export function getBrandNavIconClassName(active: boolean) {
  return active
    ? `flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${BRAND_INSET_BORDER_CLASS_NAME} bg-background text-primary transition-colors`
    : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/45 bg-background text-muted-foreground transition-colors group-hover:text-foreground";
}

export function getBrandNavHint(active: boolean, sectionKey: "workspace" | "system") {
  if (active) {
    return "当前工作区";
  }

  return sectionKey === "system" ? "系统管理" : "进入模块";
}
