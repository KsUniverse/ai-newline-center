import type { BenchmarkVideoTag } from "@prisma/client";

export type { BenchmarkVideoTag };

export type DateRangeToken = "today" | "yesterday" | "this_week";
export type BannedDateRangeToken = "today" | "yesterday" | "this_week" | "this_month";
export type DashboardVideoSortBy = "recommended" | "likes" | "time";

export const BENCHMARK_VIDEO_TAG_LABELS: Record<BenchmarkVideoTag, string> = {
  LIMIT_UP: "涨停榜",
  DRAGON_TIGER: "龙虎榜",
  OVERNIGHT: "隔夜单",
  DARK_POOL: "暗盘资金",
  THEME_REVIEW: "题材梳理",
  THREE_DRAGONS: "三只妖龙",
  NOON_REVIEW: "午评",
  RECAP: "复盘",
};

export const BENCHMARK_VIDEO_TAG_VALUES = Object.keys(BENCHMARK_VIDEO_TAG_LABELS) as BenchmarkVideoTag[];

export const DATE_RANGE_LABELS: Record<DateRangeToken, string> = {
  today: "今日",
  yesterday: "昨日",
  this_week: "本周",
};

export const BANNED_DATE_RANGE_LABELS: Record<BannedDateRangeToken, string> = {
  today: "今日",
  yesterday: "昨日",
  this_week: "本周",
  this_month: "本月",
};

export const DASHBOARD_VIDEO_SORT_LABELS: Record<DashboardVideoSortBy, string> = {
  recommended: "推荐",
  likes: "点赞",
  time: "时间",
};

export interface DashboardVideoItem {
  id: string;
  videoId: string;
  title: string;
  coverUrl: string | null;
  videoUrl: string | null;
  likeCount: number;
  publishedAt: string | null;
  customTag: BenchmarkVideoTag | null;
  isBringOrder: boolean;
  account: { id: string; nickname: string; avatar: string };
}

export interface DashboardVideosResult {
  items: DashboardVideoItem[];
  nextCursor: string | null;
  total: number;
}

export interface BannedAccountItem {
  id: string;
  nickname: string;
  avatar: string;
  douyinNumber: string | null;
  bannedAt: string;
}

export function formatLikeCount(count: number): string {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}w`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return date.toLocaleDateString("zh-CN");
}

export function formatBannedAt(isoString: string): string {
  const date = new Date(isoString);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${mins}`;
}
