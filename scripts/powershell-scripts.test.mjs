import { readFileSync } from "fs";

import { describe, expect, it } from "vitest";

const scriptPaths = [
  "scripts/deploy-build.ps1",
  "scripts/deploy-reload.ps1",
  "scripts/server/setup.ps1",
  "scripts/server/start.ps1",
  "scripts/server/update.ps1",
];

function hasOnlyAscii(content) {
  return !/[^\x09\x0A\x0D\x20-\x7E]/.test(content);
}

function firstMeaningfulLine(content) {
  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#"));
}

describe("PowerShell deployment scripts", () => {
  it.each(scriptPaths)("keeps %s ASCII-only for Windows PowerShell 5.1", (path) => {
    const content = readFileSync(path, "utf8");

    expect(hasOnlyAscii(content)).toBe(true);
  });

  it.each(scriptPaths)("keeps param block first in %s", (path) => {
    const content = readFileSync(path, "utf8");

    expect(firstMeaningfulLine(content)).toBe("param(");
  });
});
