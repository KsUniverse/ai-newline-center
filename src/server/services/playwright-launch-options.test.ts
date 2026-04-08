import { describe, expect, it } from "vitest";

import { resolveChromiumLaunchOptions } from "@/server/services/playwright-launch-options";

describe("resolveChromiumLaunchOptions", () => {
  it("keeps headed mode on local-style environments", () => {
    expect(
      resolveChromiumLaunchOptions({
        requestedHeadless: false,
        openDevtools: true,
        platform: "darwin",
        display: ":0",
      }),
    ).toEqual({
      headless: false,
      args: ["--auto-open-devtools-for-tabs"],
    });
  });

  it("falls back to headless on linux servers without DISPLAY", () => {
    expect(
      resolveChromiumLaunchOptions({
        requestedHeadless: false,
        openDevtools: false,
        platform: "linux",
        display: undefined,
      }),
    ).toEqual({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  });

  it("adds sandbox-safe flags for linux even when already headless", () => {
    expect(
      resolveChromiumLaunchOptions({
        requestedHeadless: true,
        openDevtools: false,
        platform: "linux",
        display: undefined,
      }),
    ).toEqual({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  });
});
