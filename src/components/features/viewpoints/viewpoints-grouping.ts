import type { FragmentDTO } from "@/types/fragment";

export interface ViewpointDateGroup {
  key: string;
  label: string;
  items: FragmentDTO[];
}

function toShanghaiDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function toShanghaiDateLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);

  if (year == null || month == null || day == null) {
    throw new Error(`Invalid Shanghai date key: ${key}`);
  }

  const date = new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0));

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

export function groupHistoricalViewpointsByDate(items: FragmentDTO[]): ViewpointDateGroup[] {
  const groups = new Map<string, FragmentDTO[]>();

  for (const item of items) {
    const key = toShanghaiDateKey(item.createdAt);
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }

  return Array.from(groups.entries())
    .sort((left, right) => (left[0] < right[0] ? 1 : -1))
    .map(([key, groupedItems]) => ({
      key,
      label: toShanghaiDateLabel(key),
      items: groupedItems,
    }));
}
