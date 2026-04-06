import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CRAWLER_API_URL: z.string().url().optional(),
  DOUYIN_LOGIN_STATE_DIR: z.string().optional(),
  DOUYIN_LOGIN_PAGE_URL: z.string().url().default("https://www.douyin.com/"),
  DOUYIN_LOGIN_OPEN_DEVTOOLS: z.coerce.boolean().default(false),
  DOUYIN_LOGIN_TIMEOUT_MS: z.coerce.number().int().min(60_000).default(180_000),
  REDIS_URL: z.string().url().optional(),
  ACCOUNT_SYNC_CRON: z.string().optional(),
  VIDEO_SYNC_CRON: z.string().optional(),
  VIDEO_SNAPSHOT_CRON: z.string().optional(),
  COLLECTION_SYNC_CRON: z.string().optional(),
  TRANSCRIPTION_AI_MODEL: z.string().default("openai/whisper-1"),
  OPENAI_API_KEY: z.string().optional(),
  TRANSCRIBE_BASE_URL: z.string().url().optional(),
  TRANSCRIBE_API_KEY: z.string().optional(),
  TRANSCRIBE_MODEL_NAME: z.string().optional(),
  ARK_API_KEY: z.string().optional(),
  ARK_BASE_URL: z.string().url().optional(),
  ARK_TRANSCRIBE_MODEL: z.string().optional(),
  ARK_DECOMPOSE_MODEL: z.string().optional(),
  ARK_REWRITE_MODEL: z.string().optional(),
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
