import { crawlerCookieRepository } from "@/server/repositories/crawler-cookie.repository";
import { AppError } from "@/lib/errors";
import { getSharedRedisClient } from "@/lib/redis";
import type { CrawlerCookieDTO } from "@/types/crawler-cookie";

class CrawlerCookieService {
  private counterKey(organizationId: string): string {
    return `crawler:cookie:counter:${organizationId}`;
  }

  private pointerKey(organizationId: string): string {
    return `crawler:cookie:pointer:${organizationId}`;
  }

  private async resetRedisState(organizationId: string): Promise<void> {
    try {
      const redis = getSharedRedisClient();
      if (!redis) return;
      await redis.del(this.counterKey(organizationId), this.pointerKey(organizationId));
    } catch (error) {
      console.warn("[CrawlerCookieService] 归零 Redis 状态失败", {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async list(organizationId: string): Promise<CrawlerCookieDTO[]> {
    return crawlerCookieRepository.findAllByOrganization(organizationId);
  }

  async create(organizationId: string, plaintextValue: string): Promise<CrawlerCookieDTO> {
    return crawlerCookieRepository.create(organizationId, plaintextValue);
  }

  async delete(id: string, organizationId: string): Promise<{ deletedCount: number }> {
    const deleted = await crawlerCookieRepository.delete(id, organizationId);
    if (!deleted) {
      throw new AppError("NOT_FOUND", "Cookie 不存在或无权操作", 404);
    }
    await this.resetRedisState(organizationId);
    return { deletedCount: 1 };
  }

  async deleteMany(ids: string[], organizationId: string): Promise<{ deletedCount: number }> {
    const count = await crawlerCookieRepository.deleteMany(ids, organizationId);
    if (count === 0) {
      throw new AppError("NOT_FOUND", "Cookie 不存在或无权操作", 404);
    }
    await this.resetRedisState(organizationId);
    return { deletedCount: count };
  }
}

export const crawlerCookieService = new CrawlerCookieService();
