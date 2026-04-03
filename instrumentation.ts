export async function register() {
  // NEXT_RUNTIME and NODE_ENV are Next.js internal / Node.js globals used here
  // before env.ts is loaded — direct process.env access is intentional and safe.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "test") {
    const { startScheduler } = await import("./src/lib/scheduler");
    startScheduler();
  }
}
