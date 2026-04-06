import { describe, expect, it } from "vitest";

import {
  getAiWorkspaceColumnOrder,
  getAiWorkspaceModeCopy,
} from "./ai-workspace-layout";

describe("ai workspace layout helpers", () => {
  it("keeps the understanding mode in video, transcript, decomposition order", () => {
    expect(getAiWorkspaceColumnOrder("understanding")).toEqual([
      "video",
      "transcript",
      "decomposition",
    ]);
  });

  it("moves rewrite mode into decomposition, transcript, rewrite order", () => {
    expect(getAiWorkspaceColumnOrder("rewrite")).toEqual([
      "decomposition",
      "transcript",
      "rewrite",
    ]);
  });

  it("describes the transition between the two modes", () => {
    expect(getAiWorkspaceModeCopy("understanding").switchLabel).toContain("进入仿写态");
    expect(getAiWorkspaceModeCopy("rewrite").switchLabel).toContain("返回理解态");
    expect(getAiWorkspaceModeCopy("rewrite").videoCardLabel).toContain("缩略卡");
  });
});
