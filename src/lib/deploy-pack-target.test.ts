import { describe, expect, it } from "vitest";

import { parsePackArgs } from "../../scripts/pack-target.mjs";

describe("parsePackArgs", () => {
  it("defaults to linux target and package version", () => {
    expect(parsePackArgs([], "0.5.1")).toEqual({
      version: "0.5.1",
      target: "linux",
      archiveFileName: "app-v0.5.1.tar.gz",
    });
  });

  it("supports explicit version argument", () => {
    expect(parsePackArgs(["0.6.0"], "0.5.1")).toEqual({
      version: "0.6.0",
      target: "linux",
      archiveFileName: "app-v0.6.0.tar.gz",
    });
  });

  it("supports windows target flag", () => {
    expect(parsePackArgs(["--target=windows"], "0.5.1")).toEqual({
      version: "0.5.1",
      target: "windows",
      archiveFileName: "app-v0.5.1-windows.zip",
    });
  });

  it("supports windows target and explicit version together", () => {
    expect(parsePackArgs(["0.6.0", "--target=windows"], "0.5.1")).toEqual({
      version: "0.6.0",
      target: "windows",
      archiveFileName: "app-v0.6.0-windows.zip",
    });
  });
});
