import IORedis from "ioredis";

import { env } from "@/lib/env";

export const TRANSCRIPTION_CHANNEL_PREFIX = "transcription:";

export function createBullMQRedisConnection(): IORedis {
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is not configured");
  }

  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

export function createPubSubRedisClient(): IORedis {
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is not configured");
  }

  return new IORedis(env.REDIS_URL);
}
