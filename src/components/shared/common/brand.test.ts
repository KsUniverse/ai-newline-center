import { describe, expect, it } from "vitest";

import {
  BRAND_COMPACT_ACTION_CLASS_NAME,
  BRAND_INSET_SURFACE_CLASS_NAME,
  BRAND_SURFACE_CLASS_NAME,
  getBrandNavHint,
  getBrandNavIconClassName,
  getBrandNavItemClassName,
} from "@/components/shared/common/brand";

describe("brand presentation", () => {
  it("keeps primary surfaces aligned with the documented card language", () => {
    expect(BRAND_SURFACE_CLASS_NAME).toContain("rounded-3xl");
    expect(BRAND_SURFACE_CLASS_NAME).toContain("border-border/60");
    expect(BRAND_SURFACE_CLASS_NAME).toContain("bg-card/90");
    expect(BRAND_SURFACE_CLASS_NAME).toContain("shadow-sm");
  });

  it("keeps inset surfaces visually lighter than primary surfaces", () => {
    expect(BRAND_INSET_SURFACE_CLASS_NAME).toContain("bg-background/80");
    expect(BRAND_INSET_SURFACE_CLASS_NAME).toContain("rounded-2xl");
  });

  it("keeps compact actions aligned with dashboard header buttons", () => {
    expect(BRAND_COMPACT_ACTION_CLASS_NAME).toContain("h-8");
    expect(BRAND_COMPACT_ACTION_CLASS_NAME).toContain("px-3");
    expect(BRAND_COMPACT_ACTION_CLASS_NAME).toContain("text-sm");
  });

  it("uses stronger active affordances for active nav items", () => {
    expect(getBrandNavItemClassName(true)).toContain("bg-primary/10");
    expect(getBrandNavItemClassName(false)).toContain("hover:bg-card/80");
    expect(getBrandNavIconClassName(true)).toContain("text-primary");
    expect(getBrandNavIconClassName(false)).toContain("text-muted-foreground");
  });

  it("keeps nav hints contextual without changing interaction structure", () => {
    expect(getBrandNavHint(true, "workspace")).toBe("当前工作区");
    expect(getBrandNavHint(false, "workspace")).toBe("进入模块");
    expect(getBrandNavHint(false, "system")).toBe("系统管理");
  });
});
