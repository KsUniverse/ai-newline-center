import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const ENV_FILENAME = ".env.build.production";
const envPath = resolve(process.cwd(), ENV_FILENAME);

if (!existsSync(envPath)) {
  console.error(`[build] Missing ${ENV_FILENAME} at ${envPath}`);
  process.exit(1);
}

function parseEnvFile(content) {
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    value = value
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t");

    parsed[key] = value;
  }

  return parsed;
}

const fileEnv = parseEnvFile(readFileSync(envPath, "utf8"));
const nextBin = resolve(process.cwd(), "node_modules", "next", "dist", "bin", "next");

const child = spawn(
  process.execPath,
  [nextBin, "build"],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      ...fileEnv,
      NODE_ENV: "production",
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
