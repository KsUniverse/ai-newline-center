import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-client";

import {
  BENCHMARK_LIBRARY_TITLE,
  getBenchmarkAddDrawerDescription,
  getBenchmarkAddFetchActionLabel,
  getBenchmarkAddInputHint,
  getBenchmarkAddPreviewErrorMessage,
  getBenchmarkAddSuccessMessage,
  getBenchmarkAddMemberHint,
  getBenchmarkArchiveDialogDescription,
  getBenchmarkArchiveActionLabel,
  getBenchmarkArchiveEntryHint,
  getBenchmarkArchiveErrorMessage,
  getBenchmarkArchiveHint,
  getBenchmarkArchiveSuccessMessage,
  getBenchmarkCreatedByLabel,
  getBenchmarkEmptyStateDescription,
  getBenchmarkLibraryCountLabel,
  getBenchmarkLibraryOverviewDescription,
  getBenchmarkSharedLabel,
  getBenchmarkVideoStatusHint,
  getBenchmarkVideoStatusLabel,
} from "./benchmark-copy";

describe("benchmark copy helpers", () => {
  it("maps BENCHMARK_EXISTS to shared-library reuse copy", () => {
    expect(
      getBenchmarkAddPreviewErrorMessage(
        new ApiError("BENCHMARK_EXISTS", "legacy message"),
      ),
    ).toContain("直接复用现有档案");
  });

  it("preserves forbidden archive guidance from backend", () => {
    expect(
      getBenchmarkArchiveErrorMessage(
        new ApiError("FORBIDDEN", "仅关联员工可归档该对标账号"),
      ),
    ).toBe("仅关联成员可将该研究对象移入归档库。");
  });

  it("returns stable shared-library labels", () => {
    expect(BENCHMARK_LIBRARY_TITLE).toBe("组织研究库");
    expect(getBenchmarkAddSuccessMessage()).toBe("已加入组织共享研究库。");
    expect(getBenchmarkArchiveSuccessMessage()).toBe("研究对象已移入归档库。");
    expect(getBenchmarkSharedLabel("陈晨")).toBe("组织共享 · 最初由 陈晨 录入");
    expect(getBenchmarkCreatedByLabel("陈晨")).toBe("最初录入成员：陈晨");
    expect(getBenchmarkArchiveHint()).toContain("成员关系");
    expect(getBenchmarkArchiveEntryHint(true)).toContain("可将其移入归档库");
    expect(getBenchmarkArchiveEntryHint(false)).toContain("仅已关联成员可执行归档");
    expect(getBenchmarkAddDrawerDescription()).toContain("复用组织已有档案");
    expect(getBenchmarkAddInputHint()).toContain("抖音主页链接");
    expect(getBenchmarkAddMemberHint()).toContain("成员关联");
    expect(getBenchmarkAddFetchActionLabel()).toBe("获取账号预览");
    expect(getBenchmarkArchiveActionLabel()).toBe("移入归档");
    expect(getBenchmarkArchiveDialogDescription("陈晨")).toContain("陈晨 的账号档案");
    expect(getBenchmarkEmptyStateDescription()).toContain("组织共享研究库");
    expect(getBenchmarkLibraryOverviewDescription()).toContain("只会建立新的关联关系");
    expect(getBenchmarkLibraryCountLabel(3)).toBe("在库 3 个研究对象");
    expect(getBenchmarkLibraryCountLabel(2, true)).toBe("已归档 2 个研究对象");
    expect(getBenchmarkVideoStatusLabel("videos/demo.mp4")).toBe("可转录");
    expect(getBenchmarkVideoStatusLabel(null)).toBe("待同步");
    expect(getBenchmarkVideoStatusHint("videos/demo.mp4")).toContain("可发起或编辑研究转录");
    expect(getBenchmarkVideoStatusHint(null)).toContain("暂时无法生成研究转录");
  });
});