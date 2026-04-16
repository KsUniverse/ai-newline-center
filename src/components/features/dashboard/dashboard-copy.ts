import type { BenchmarkVideoTag, BannedDateRangeToken } from "@/types/benchmark-video";

const BANNED_RANGE_PREFIX: Record<BannedDateRangeToken, string> = {
  today: "今日",
  yesterday: "昨日",
  this_week: "本周",
  this_month: "本月",
};

export function getDashboardVideoSectionDescription(loading: boolean, total: number): string {
  if (loading) {
    return "加载中…";
  }

  return `共 ${total} 条，按点赞倒序`;
}

export function getVideoTagTone(tag: BenchmarkVideoTag | null): "primary" | "muted" {
  return tag ? "primary" : "muted";
}

export function getBringOrderTone(isBringOrder: boolean): "success" | "muted" {
  return isBringOrder ? "success" : "muted";
}

export function getBannedSectionDescription(
  dateRange: BannedDateRangeToken,
  count: number,
): string {
  return `${BANNED_RANGE_PREFIX[dateRange]}新增 ${count} 个封禁账号`;
}

export function getTagUpdateErrorMessage(): string {
  return "标签更新失败，请稍后重试";
}

export function getBringOrderToggleErrorMessage(): string {
  return "带单状态更新失败，请稍后重试";
}

export function getBannedFetchErrorMessage(): string {
  return "封禁列表加载失败，请稍后重试";
}

export function getVideoFetchErrorMessage(): string {
  return "短视频列表加载失败，请稍后重试";
}

export function getVideoLoadMoreErrorMessage(): string {
  return "加载更多视频失败，请稍后重试";
}
