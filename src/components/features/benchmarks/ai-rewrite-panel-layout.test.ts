import { describe, expect, it } from "vitest";

import {
  getRewritePanelFocus,
  REWRITE_PANEL_SETTINGS_GRID_CLASS_NAME,
} from "./ai-rewrite-panel-layout";

describe("AI rewrite panel layout", () => {
  it("treats material input and result editor as the primary focus", () => {
    expect(getRewritePanelFocus("temporaryMaterial")).toBe("primary");
    expect(getRewritePanelFocus("resultEditor")).toBe("primary");
  });

  it("keeps viewpoints, account, model, and version in a compact secondary area", () => {
    expect(getRewritePanelFocus("viewpoints")).toBe("secondary");
    expect(getRewritePanelFocus("targetAccount")).toBe("secondary");
    expect(getRewritePanelFocus("model")).toBe("secondary");
    expect(getRewritePanelFocus("version")).toBe("secondary");
    expect(REWRITE_PANEL_SETTINGS_GRID_CLASS_NAME).toContain("grid-cols-2");
  });
});
