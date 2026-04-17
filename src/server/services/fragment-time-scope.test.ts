import { describe, expect, it } from "vitest";

import { getShanghaiDayBounds } from "@/server/services/fragment-time-scope";

describe("getShanghaiDayBounds", () => {
  it("returns the current Shanghai calendar day bounds in UTC", () => {
    const bounds = getShanghaiDayBounds(new Date("2026-04-10T03:15:00.000Z"));

    expect(bounds.start.toISOString()).toBe("2026-04-09T16:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-04-10T16:00:00.000Z");
  });
});
