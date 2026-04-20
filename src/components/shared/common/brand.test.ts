import { describe, expect, it } from "vitest";

import {
  BRAND_COMPACT_ACTION_CLASS_NAME,
  BRAND_DIVIDER_CLASS_NAME,
  BRAND_INSET_BORDER_CLASS_NAME,
  BRAND_INSET_SURFACE_CLASS_NAME,
  BRAND_OUTER_PANEL_BORDER_CLASS_NAME,
  BRAND_PILL_BASE_CLASS_NAME,
  BRAND_PILL_TONE_CLASS_NAMES,
  BRAND_OVERLAY_SURFACE_CLASS_NAME,
  BRAND_SURFACE_CLASS_NAME,
  BRAND_WORKSPACE_PANEL_CLASS_NAME,
  getBrandNavHint,
  getBrandNavIconClassName,
  getBrandNavItemClassName,
} from "@/components/shared/common/brand";

describe("brand presentation", () => {
  it("keeps primary surfaces aligned with the harder editorial panel language", () => {
    expect(BRAND_SURFACE_CLASS_NAME).toContain("rounded-xl");
    expect(BRAND_SURFACE_CLASS_NAME).toContain("border-border/55");
    expect(BRAND_SURFACE_CLASS_NAME).toContain("bg-card");
    expect(BRAND_SURFACE_CLASS_NAME).not.toContain("rounded-3xl");
    expect(BRAND_SURFACE_CLASS_NAME).not.toContain("shadow-sm");
  });

  it("keeps inset surfaces visually tighter than the primary panels", () => {
    expect(BRAND_INSET_SURFACE_CLASS_NAME).toContain("bg-background");
    expect(BRAND_INSET_SURFACE_CLASS_NAME).toContain("rounded-lg");
    expect(BRAND_INSET_SURFACE_CLASS_NAME).toContain("border-border/45");
    expect(BRAND_INSET_SURFACE_CLASS_NAME).not.toContain("shadow-sm");
  });

  it("keeps compact actions aligned with dashboard header buttons", () => {
    expect(BRAND_COMPACT_ACTION_CLASS_NAME).toContain("h-8");
    expect(BRAND_COMPACT_ACTION_CLASS_NAME).toContain("px-3");
    expect(BRAND_COMPACT_ACTION_CLASS_NAME).toContain("text-sm");
    expect(BRAND_COMPACT_ACTION_CLASS_NAME).not.toContain("shadow-sm");
  });

  it("keeps internal dividers lighter than panel outlines", () => {
    expect(BRAND_DIVIDER_CLASS_NAME).toContain("border-border/28");
    expect(BRAND_OUTER_PANEL_BORDER_CLASS_NAME).toContain("border-border/55");
    expect(BRAND_INSET_BORDER_CLASS_NAME).toContain("border-border/45");
  });

  it("keeps workspace panels on the shared global radius instead of a custom oversized shell", () => {
    expect(BRAND_WORKSPACE_PANEL_CLASS_NAME).toContain("rounded-xl");
    expect(BRAND_WORKSPACE_PANEL_CLASS_NAME).toContain("border-border/55");
    expect(BRAND_WORKSPACE_PANEL_CLASS_NAME).not.toContain("rounded-[28px]");
  });

  it("keeps pills on the compact rounded-md system instead of rounded-full", () => {
    expect(BRAND_PILL_BASE_CLASS_NAME).toContain("rounded-md");
    expect(BRAND_PILL_BASE_CLASS_NAME).not.toContain("rounded-full");
    expect(BRAND_PILL_TONE_CLASS_NAMES.default).toContain("border-border/45");
  });

  it("keeps overlay surfaces lighter than the old heavy panel shadow model", () => {
    expect(BRAND_OVERLAY_SURFACE_CLASS_NAME).toContain("rounded-xl");
    expect(BRAND_OVERLAY_SURFACE_CLASS_NAME).toContain("border-border/55");
    expect(BRAND_OVERLAY_SURFACE_CLASS_NAME).toContain("shadow-[0_18px_44px_-32px_rgba(15,23,42,0.42)]");
  });

  it("uses tighter, flatter active affordances for nav items", () => {
    expect(getBrandNavItemClassName(true)).toContain("rounded-xl");
    expect(getBrandNavItemClassName(true)).toContain("border-border/55");
    expect(getBrandNavItemClassName(true)).toContain("bg-accent/45");
    expect(getBrandNavItemClassName(true)).not.toContain("shadow-sm");
    expect(getBrandNavItemClassName(false)).toContain("hover:bg-accent/55");
    expect(getBrandNavIconClassName(true)).toContain("text-primary");
    expect(getBrandNavIconClassName(false)).toContain("text-muted-foreground");
  });

  it("keeps nav hints contextual without changing interaction structure", () => {
    expect(getBrandNavHint(true, "workspace")).toBe("当前工作区");
    expect(getBrandNavHint(false, "workspace")).toBe("进入模块");
    expect(getBrandNavHint(false, "system")).toBe("系统管理");
  });
});
