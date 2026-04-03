declare module "node-cron" {
  interface ScheduledTask {
    start(): void;
    stop(): void;
    destroy(): void;
  }

  interface Cron {
    schedule(expression: string, func: () => void | Promise<void>): ScheduledTask;
  }

  const cron: Cron;

  export default cron;
}
