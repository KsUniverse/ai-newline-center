import { describe, expect, it } from "vitest";

import {
  SHARED_MODAL_LAYER,
  WORKSPACE_BACKDROP_LAYER,
  WORKSPACE_GHOST_LAYER,
  WORKSPACE_SHELL_LAYER,
} from "@/components/ui/layering";

describe("layering", () => {
  it("keeps workspace overlay layers below the shared modal layer", () => {
    expect(WORKSPACE_BACKDROP_LAYER).toBeLessThan(SHARED_MODAL_LAYER);
    expect(WORKSPACE_SHELL_LAYER).toBeLessThan(SHARED_MODAL_LAYER);
    expect(WORKSPACE_GHOST_LAYER).toBeLessThan(SHARED_MODAL_LAYER);
  });

  it("keeps workspace internal layers ordered from backdrop to shell to ghost", () => {
    expect(WORKSPACE_BACKDROP_LAYER).toBeLessThan(WORKSPACE_SHELL_LAYER);
    expect(WORKSPACE_SHELL_LAYER).toBeLessThan(WORKSPACE_GHOST_LAYER);
  });
});
