import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CRAWLER_API_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  ACCOUNT_SYNC_CRON: z.string().optional(),
  VIDEO_SYNC_CRON: z.string().optional(),
  VIDEO_SNAPSHOT_CRON: z.string().optional(),
  COLLECTION_SYNC_CRON: z.string().optional(),
  SEED_ADMIN_ACCOUNT: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_ADMIN_NAME: z.string().optional(),
  SEED_ORG_NAME: z.string().optional(),
}).superRefine((values, ctx) => {
  if (values.NODE_ENV === "production" && !values.NEXTAUTH_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["NEXTAUTH_URL"],
      message: "NEXTAUTH_URL 在生产环境必填",
    });
  }

  if (values.NODE_ENV === "production" && !values.CRAWLER_API_URL && process.env.NEXT_PHASE !== "phase-production-build") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["CRAWLER_API_URL"],
      message: "CRAWLER_API_URL 在生产环境必填",
    });
  }
});

export function parseEnv(rawEnv: Record<string, string | undefined>) {
  return envSchema.parse(rawEnv);
}

export const env = parseEnv(process.env);
