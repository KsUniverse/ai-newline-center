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
    const { startScheduler } = await import("./src/lib/scheduler");
    const { startTranscriptionWorker } = await import("./src/lib/transcription-worker");

    console.log("[Instrumentation] starting scheduler and transcription worker", {
      pid: process.pid,
    });
    startScheduler();
    startTranscriptionWorker();
  } catch (error) {
    console.error("[Instrumentation] background bootstrap failed", {
      pid: process.pid,
      error,
    });
    throw error;
  }
}
