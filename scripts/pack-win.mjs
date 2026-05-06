#!/usr/bin/env node

import { runPack } from "./pack-lib.mjs";

runPack({
  scriptUrl: import.meta.url,
  target: "windows",
  versionArg: process.argv[2],
});
