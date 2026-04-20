import { describe, expect, it } from "vitest";

import {
  buildAiWorkspaceTransitionOrigin,
  parseBorderRadiusPx,
} from "@/components/features/benchmarks/ai-workspace-transition";

describe("ai workspace transition", () => {
  it("parses css border radius values into transition-safe pixel numbers", () => {
    expect(parseBorderRadiusPx("24px")).toBe(24);
    expect(parseBorderRadiusPx("0px")).toBe(0);
    expect(parseBorderRadiusPx("")).toBe(0);
  });

  it("keeps the provided border radius instead of replacing it with a stale magic number", () => {
    const origin = buildAiWorkspaceTransitionOrigin(
      { top: 10, left: 20, width: 30, height: 40 },
      parseBorderRadiusPx("0px"),
    );

    expect(origin.borderRadius).toBe(0);
  });
});
