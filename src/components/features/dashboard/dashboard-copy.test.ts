import { describe, expect, it } from "vitest";

import {
  getBannedFetchErrorMessage,
  getBannedSectionDescription,
  getBringOrderToggleErrorMessage,
  getBringOrderTone,
  getDashboardVideoSectionDescription,
  getTagUpdateErrorMessage,
  getVideoFetchErrorMessage,
  getVideoLoadMoreErrorMessage,
  getVideoTagTone,
} from "@/components/features/dashboard/dashboard-copy";

describe("dashboard copy helpers", () => {
  it("builds the video section description from loading and total state", () => {
    expect(getDashboardVideoSectionDescription(true, 0, "recommended")).toBe("加载中…");
    expect(getDashboardVideoSectionDescription(false, 12, "recommended")).toBe("共 12 条，按推荐排序");
    expect(getDashboardVideoSectionDescription(false, 12, "likes")).toBe("共 12 条，按点赞倒序");
    expect(getDashboardVideoSectionDescription(false, 12, "time")).toBe("共 12 条，按时间倒序");
  });

  it("returns semantic tones for tag and bring-order state", () => {
    expect(getVideoTagTone(null)).toBe("muted");
    expect(getVideoTagTone("RECAP")).toBe("primary");
    expect(getBringOrderTone(true)).toBe("success");
    expect(getBringOrderTone(false)).toBe("muted");
  });

  it("builds the banned section description from range and count", () => {
    expect(getBannedSectionDescription("this_week", 0)).toBe("本周新增 0 个封禁账号");
    expect(getBannedSectionDescription("this_month", 8)).toBe("本月新增 8 个封禁账号");
  });

  it("returns stable error copy for dashboard actions", () => {
    expect(getTagUpdateErrorMessage()).toBe("标签更新失败，请稍后重试");
    expect(getBringOrderToggleErrorMessage()).toBe("带单状态更新失败，请稍后重试");
    expect(getBannedFetchErrorMessage()).toBe("封禁列表加载失败，请稍后重试");
    expect(getVideoFetchErrorMessage()).toBe("短视频列表加载失败，请稍后重试");
    expect(getVideoLoadMoreErrorMessage()).toBe("加载更多视频失败，请稍后重试");
  });
});
