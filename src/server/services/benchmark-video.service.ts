import { BenchmarkVideoTag, UserRole } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { benchmarkVideoRepository } from "@/server/repositories/benchmark-video.repository";
import type { SessionUser } from "@/types/session";

export type DateRangeToken = "today" | "yesterday" | "this_week";
export type BannedDateRangeToken = "today" | "yesterday" | "this_week" | "this_month";

interface DateRange {
  gte: Date;
  lt?: Date;
}

export interface DashboardVideoItem {
  id: string;
  videoId: string;
  title: string;
  coverUrl: string | null;
  likeCount: number;
  publishedAt: string | null;
  customTag: BenchmarkVideoTag | null;
  isBringOrder: boolean;
  account: { id: string; nickname: string; avatar: string };
}

export interface DashboardVideosResult {
  items: DashboardVideoItem[];
  nextCursor: string | null;
  total: number;
}

class BenchmarkVideoService {
  async listDashboardVideos(
    caller: SessionUser,
    params: {
      dateRange: DateRangeToken;
      customTag?: BenchmarkVideoTag;
      isBringOrder?: boolean;
      cursor?: string;
      limit?: number;
    },
  ): Promise<DashboardVideosResult> {
    const limit = Math.min(params.limit ?? 20, 50);
    const dateRange = this.resolveDateRange(params.dateRange);

    const result = await benchmarkVideoRepository.findDashboardVideos({
      organizationId:
        caller.role === UserRole.SUPER_ADMIN ? undefined : caller.organizationId,
      publishedAtGte: dateRange.gte,
      publishedAtLt: dateRange.lt,
      customTag: params.customTag,
      isBringOrder: params.isBringOrder,
      cursor: params.cursor,
      limit,
    });

    return {
      items: result.items.map((item) => ({
        ...item,
        publishedAt: item.publishedAt?.toISOString() ?? null,
      })),
      nextCursor: result.nextCursor,
      total: result.total,
    };
  }

  async updateVideoTag(
    caller: SessionUser,
    videoId: string,
    customTag: BenchmarkVideoTag | null,
  ): Promise<{ id: string; customTag: BenchmarkVideoTag | null }> {
    try {
      const updated = await benchmarkVideoRepository.updateCustomTag(
        videoId,
        this.resolveOrganizationScope(caller),
        customTag,
      );
      return { id: updated.id, customTag: updated.customTag };
    } catch {
      throw new AppError("NOT_FOUND", "视频不存在或无权操作", 404);
    }
  }

  async updateVideoBringOrder(
    caller: SessionUser,
    videoId: string,
    isBringOrder: boolean,
  ): Promise<{ id: string; isBringOrder: boolean }> {
    try {
      const updated = await benchmarkVideoRepository.updateBringOrder(
        videoId,
        this.resolveOrganizationScope(caller),
        isBringOrder,
      );
      return { id: updated.id, isBringOrder: updated.isBringOrder };
    } catch {
      throw new AppError("NOT_FOUND", "视频不存在或无权操作", 404);
    }
  }

  private resolveDateRange(token: DateRangeToken): DateRange {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (token) {
      case "today": {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { gte: today, lt: tomorrow };
      }
      case "yesterday": {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { gte: yesterday, lt: today };
      }
      case "this_week": {
        const dayOfWeek = today.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + diff);
        return { gte: monday };
      }
    }
  }

  private resolveOrganizationScope(caller: SessionUser): string | undefined {
    return caller.role === UserRole.SUPER_ADMIN ? undefined : caller.organizationId;
  }
}

export const benchmarkVideoService = new BenchmarkVideoService();
