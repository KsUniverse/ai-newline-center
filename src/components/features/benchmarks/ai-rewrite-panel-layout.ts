export type RewritePanelSection =
  | "temporaryMaterial"
  | "resultEditor"
  | "viewpoints"
  | "targetAccount"
  | "model"
  | "version";

export type RewritePanelFocus = "primary" | "secondary";

const PRIMARY_SECTIONS = new Set<RewritePanelSection>([
  "temporaryMaterial",
  "resultEditor",
]);

export const REWRITE_PANEL_SETTINGS_GRID_CLASS_NAME =
  "grid grid-cols-2 gap-2";

export function getRewritePanelFocus(section: RewritePanelSection): RewritePanelFocus {
  return PRIMARY_SECTIONS.has(section) ? "primary" : "secondary";
}
