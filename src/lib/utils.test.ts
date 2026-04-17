import { describe, expect, it } from "vitest";

import { formatDateTime } from "@/lib/utils";

describe("formatDateTime", () => {
  it("formats timestamps as yyyy-MM-dd HH:mm", () => {
    expect(formatDateTime("2026-04-17T02:33:41.000Z")).toBe("2026-04-17 10:33");
  });
});
