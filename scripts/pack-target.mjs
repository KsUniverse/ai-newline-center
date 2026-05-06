const TARGETS = {
  linux: {
    archiveSuffix: ".tar.gz",
    fileName: (version) => `app-v${version}.tar.gz`,
  },
  windows: {
    archiveSuffix: ".zip",
    fileName: (version) => `app-v${version}-windows.zip`,
  },
};

export function parsePackArgs(argv, packageVersion) {
  let version = packageVersion;
  let target = "linux";

  for (const arg of argv) {
    if (arg.startsWith("--target=")) {
      const rawTarget = arg.slice("--target=".length);
      if (!(rawTarget in TARGETS)) {
        throw new Error(`Unsupported target: ${rawTarget}`);
      }
      target = rawTarget;
      continue;
    }

    if (arg.startsWith("--")) {
      continue;
    }

    version = arg;
  }

  return {
    version,
    target,
    archiveFileName: TARGETS[target].fileName(version),
  };
}
