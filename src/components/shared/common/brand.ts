export const BRAND_SURFACE_CLASS_NAME =
  "relative overflow-hidden rounded-3xl border border-border/60 bg-card/90 shadow-sm";

export const BRAND_INSET_SURFACE_CLASS_NAME =
  "rounded-2xl border border-border/60 bg-background/80 shadow-sm";

export const BRAND_FORM_SECTION_CLASS_NAME =
  "grid gap-4 rounded-3xl border border-border/60 bg-background/80 p-4 shadow-sm sm:p-5";

export const BRAND_FORM_SECTION_GRID_CLASS_NAME = `${BRAND_FORM_SECTION_CLASS_NAME} sm:grid-cols-2`;

export const BRAND_NOTE_SURFACE_CLASS_NAME =
  "rounded-3xl border border-border/60 bg-background/80 px-4 py-4 shadow-sm";

export const BRAND_FIELD_SHELL_CLASS_NAME =
  "flex items-center gap-3 rounded-2xl border border-border/60 bg-card/90 px-3 py-2.5 shadow-sm";

export const BRAND_HEADER_ICON_SHELL_CLASS_NAME =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-sm";

export const BRAND_FIELD_ICON_SHELL_CLASS_NAME =
  "flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/90 text-primary";

export const BRAND_METRIC_CARD_CLASS_NAME =
  "rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm";

export const BRAND_TABLE_WRAPPER_CLASS_NAME =
  "hidden overflow-hidden rounded-3xl border border-border/60 bg-background/80 md:block";

export const BRAND_MOBILE_CARD_CLASS_NAME =
  "rounded-3xl border border-border/60 bg-background/80 p-4 shadow-sm";

export const BRAND_STATUS_PILL_CLASS_NAME =
  "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-2.5 py-1 text-xs shadow-sm";

export const BRAND_COMPACT_ACTION_CLASS_NAME = "h-8 rounded-md px-3 text-sm shadow-sm";

export const BRAND_EYEBROW_CLASS_NAME =
  "text-2xs font-medium uppercase tracking-[0.18em] text-primary/85";

export function getBrandNavItemClassName(active: boolean) {
  return active
    ? "group flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-3 text-sm text-foreground shadow-sm shadow-primary/10 transition-all"
    : "group flex items-center gap-3 rounded-2xl border border-transparent bg-background/35 px-3 py-3 text-sm text-muted-foreground transition-all hover:border-border/60 hover:bg-card/80 hover:text-foreground";
}

export function getBrandNavIconClassName(active: boolean) {
  return active
    ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-background/90 text-primary transition-colors"
    : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background/80 text-muted-foreground transition-colors group-hover:text-foreground";
}

export function getBrandNavHint(active: boolean, sectionKey: "workspace" | "system") {
  if (active) {
    return "当前工作区";
  }

  return sectionKey === "system" ? "系统管理" : "进入模块";
}
