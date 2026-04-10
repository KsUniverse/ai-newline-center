declare global {
  // Persist bootstrap state across Next.js dev hot reloads in the same process.
  var __serverBootstrapStarted: boolean | undefined;
}

export async function ensureServerBootstrap(): Promise<void> {
  if (globalThis.__serverBootstrapStarted) {
    return;
  }

  if (process.env.NODE_ENV === "test") {
    return;
  }

  globalThis.__serverBootstrapStarted = true;

  try {
    console.log("[ServerBootstrap] starting background services", {
      pid: process.pid,
      nodeEnv: process.env.NODE_ENV ?? null,
    });

    const { startScheduler } = await import("@/lib/scheduler");
    const { startTranscriptionWorker } = await import("@/lib/transcription-worker");
    const { startRewriteWorker } = await import("@/lib/rewrite-worker");

    startScheduler();
    startTranscriptionWorker();
    startRewriteWorker();

    console.log("[ServerBootstrap] background services started", {
      pid: process.pid,
    });
  } catch (error) {
    globalThis.__serverBootstrapStarted = false;
    console.error("[ServerBootstrap] failed to start background services", {
      pid: process.pid,
      error,
    });
    throw error;
  }
}

export function resetServerBootstrapForTests(): void {
  globalThis.__serverBootstrapStarted = false;
}
