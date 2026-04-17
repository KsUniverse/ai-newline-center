import type { FragmentScope } from "@/types/fragment";

function getDatePart(
  parts: Intl.DateTimeFormatPart[],
  type: "year" | "month" | "day",
): number {
  const value = parts.find((part) => part.type === type)?.value;

  if (!value) {
    throw new Error(`Missing ${type} in Shanghai date parts`);
  }

  return Number(value);
}

export function getShanghaiDayBounds(now = new Date()): { start: Date; end: Date } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = getDatePart(parts, "year");
  const month = getDatePart(parts, "month");
  const day = getDatePart(parts, "day");

  return {
    start: new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0)),
    end: new Date(Date.UTC(year, month - 1, day + 1, -8, 0, 0, 0)),
  };
}

export function resolveFragmentCreatedAtFilter(scope: FragmentScope, now = new Date()) {
  const { start, end } = getShanghaiDayBounds(now);

  if (scope === "history") {
    return {
      lt: start,
    };
  }

  return {
    gte: start,
    lt: end,
  };
}
