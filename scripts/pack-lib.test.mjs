import { describe, expect, it } from "vitest";

import { buildArchivePlan, buildDeployGuide } from "./pack-lib.mjs";

describe("buildArchivePlan", () => {
  it("uses tar.gz for linux packages", () => {
    const plan = buildArchivePlan({
      outputDir: "/tmp/dist",
      standaloneDir: "/tmp/standalone",
      target: "linux",
      version: "0.5.1",
    });

    expect(plan.outputFile).toBe("/tmp/dist/app-v0.5.1.tar.gz");
    expect(plan.command).toContain("tar -czf");
  });

  it("uses zip for windows packages", () => {
    const plan = buildArchivePlan({
      outputDir: "/tmp/dist",
      standaloneDir: "/tmp/standalone",
      target: "windows",
      version: "0.5.1",
    });

    expect(plan.outputFile).toBe("/tmp/dist/app-v0.5.1-windows.zip");
    expect(plan.command).toContain("zip -qry");
  });
});

describe("buildDeployGuide", () => {
  it("returns powershell deployment instructions for windows packages", () => {
    const guide = buildDeployGuide({
      archiveFileName: "app-v0.5.1-windows.zip",
      target: "windows",
    });

    expect(guide).toContain("PowerShell");
    expect(guide).toContain("setup.ps1");
    expect(guide).toContain("update.ps1");
    expect(guide).not.toContain("setup.sh");
  });
});
