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

let _sharedRedisClient: IORedis | null = null;

/**
 * 懒初始化的 Redis 共享单例，供 Service 层复用。
 * REDIS_URL 未配置时返回 null。
 */
export function getSharedRedisClient(): IORedis | null {
  if (!env.REDIS_URL) return null;
  if (!_sharedRedisClient) {
    _sharedRedisClient = new IORedis(env.REDIS_URL);
  }
  return _sharedRedisClient;
}
