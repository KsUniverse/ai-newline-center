import { describe, expect, it } from "vitest";

import {
  getWorkspaceShellColumns,
  REWRITE_STAGE_GRID_TEMPLATE_COLUMNS,
} from "./ai-workspace-rewrite-layout";

describe("AI workspace rewrite layout", () => {
  it("lets the rewrite stage own the workspace instead of nesting inside outer columns", () => {
    expect(getWorkspaceShellColumns("rewrite")).toEqual(["rewrite"]);
  });

  it("uses the requested 2/4/4 rewrite column ratio", () => {
    expect(REWRITE_STAGE_GRID_TEMPLATE_COLUMNS).toBe("2fr 4fr 4fr");
  });
});
