import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  REDIS_URL: z.string().url().optional(),
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
});

export function parseEnv(rawEnv: Record<string, string | undefined>) {
  return envSchema.parse(rawEnv);
}

export const env = parseEnv(process.env);
