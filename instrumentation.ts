export async function register() {
  console.log("[Instrumentation] register called", {
    nodeEnv: process.env.NODE_ENV ?? null,
    nextRuntime: process.env.NEXT_RUNTIME ?? null,
    pid: process.pid,
  });

  if (process.env.NODE_ENV === "test") {
    console.log("[Instrumentation] skip background bootstrap in test mode");
    return;
  }

  try {
    const { ensureServerBootstrap } = await import("./src/lib/server-bootstrap");

    console.log("[Instrumentation] delegating background bootstrap", {
      pid: process.pid,
    });
    await ensureServerBootstrap();
  } catch (error) {
    console.error("[Instrumentation] background bootstrap failed", {
      pid: process.pid,
      error,
    });
    throw error;
  }
}
