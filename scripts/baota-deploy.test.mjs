import { readFileSync } from "fs";
import { createRequire } from "module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const ecosystem = require("../ecosystem.config.cjs");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

describe("Baota deployment config", () => {
  it("starts Next.js from source with a single PM2 instance", () => {
    const app = ecosystem.apps[0];

    expect(app.script).toBe("./node_modules/next/dist/bin/next");
    expect(app.args).toBe("start -H 0.0.0.0 -p 3000");
    expect(app.interpreter).toBe("node");
    expect(app.instances).toBe(1);
    expect(app.exec_mode).toBe("fork");
    expect(app.cwd).toBeDefined();
  });

  it("exposes a baota-friendly npm start command", () => {
    expect(packageJson.scripts["start:bt"]).toBe("next start -H 0.0.0.0 -p 3000");
  });
});
