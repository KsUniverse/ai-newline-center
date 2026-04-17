import { describe, expect, it } from "vitest";

import { getVisibleNavItems, getVisibleNavSections } from "@/components/shared/layout/app-navigation";

describe("app navigation", () => {
  it("groups admin management items under 系统管理", () => {
    const sections = getVisibleNavSections("SUPER_ADMIN");

    expect(sections.map((section) => section.title)).toEqual(["工作区", "系统管理"]);
    expect(sections[1]?.items.map((item) => item.label)).toEqual([
      "组织管理",
      "用户管理",
      "AI 配置",
      "爬虫 Cookie 管理",
    ]);
  });

  it("still exposes a flattened item list for non-navigation consumers", () => {
    const items = getVisibleNavItems("SUPER_ADMIN");

    expect(items.map((item) => item.label)).toContain("爬虫 Cookie 管理");
    expect(items.map((item) => item.label)).not.toContain("系统设置");
  });
});
