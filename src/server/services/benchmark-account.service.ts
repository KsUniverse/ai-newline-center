import { BenchmarkAccountMemberSource, Prisma, UserRole } from "@prisma/client";

import { AppError } from "@/lib/errors";
import {
  benchmarkAccountRepository,
  type FindManyBenchmarkAccountsParams,
} from "@/server/repositories/benchmark-account.repository";
import { benchmarkVideoRepository } from "@/server/repositories/benchmark-video.repository";
import { crawlerService } from "@/server/services/crawler.service";
import {
  type CreateDouyinAccountData,
  type ListParams,
} from "@/server/services/douyin-account.service";
import {
  mapBenchmarkAccountDetailToDto,
  mapBenchmarkAccountToDto,
  mapCrawlerProfileToPreview,
} from "@/server/services/douyin-account.mapper";
import type {
  BenchmarkAccountDTO,
  BenchmarkAccountDetailDTO,
  AccountPreview,
} from "@/types/douyin-account";
import type { PaginatedData } from "@/types/api";
import type { SessionUser } from "@/types/session";

type BenchmarkArchiveFilter = NonNullable<FindManyBenchmarkAccountsParams["archiveFilter"]>;

interface ListBenchmarksParams {
  page: number;
  limit: number;
  archiveFilter?: BenchmarkArchiveFilter;
}

class BenchmarkAccountService {
  async previewBenchmark(caller: SessionUser, profileUrl: string): Promise<AccountPreview> {
    this.assertSupportedCaller(caller);

    const secUserId = await crawlerService.getSecUserId(profileUrl);
    const profile = await crawlerService.fetchUserProfile(secUserId);

    return mapCrawlerProfileToPreview(profileUrl, profile);
  }

  async createBenchmark(
    caller: SessionUser,
    data: CreateDouyinAccountData,
  ): Promise<{ id: string; profileUrl: string; secUserId: string }> {
    this.assertSupportedCaller(caller);

    const existingBySecUserId = await benchmarkAccountRepository.findByOrganizationAndSecUserIdIncludingDeleted(
      caller.organizationId,
      data.secUserId,
    );
    if (existingBySecUserId && existingBySecUserId.deletedAt === null) {
      await benchmarkAccountRepository.upsertMember({
        benchmarkAccountId: existingBySecUserId.id,
        userId: caller.id,
        organizationId: caller.organizationId,
        source: BenchmarkAccountMemberSource.MANUAL,
      });

      return {
        id: existingBySecUserId.id,
        profileUrl: existingBySecUserId.profileUrl,
        secUserId: existingBySecUserId.secUserId ?? data.secUserId,
      };
    }
    if (existingBySecUserId && existingBySecUserId.deletedAt !== null) {
      throw new AppError(
        "BENCHMARK_ARCHIVED",
        "该对标博主已被归档，请前往归档列表查看",
        409,
      );
    }

    const existingByProfileUrl = await benchmarkAccountRepository.findByOrganizationAndProfileUrlIncludingDeleted(
      caller.organizationId,
      data.profileUrl,
    );
    if (existingByProfileUrl && existingByProfileUrl.deletedAt === null) {
      await benchmarkAccountRepository.upsertMember({
        benchmarkAccountId: existingByProfileUrl.id,
        userId: caller.id,
        organizationId: caller.organizationId,
        source: BenchmarkAccountMemberSource.MANUAL,
      });

      return {
        id: existingByProfileUrl.id,
        profileUrl: existingByProfileUrl.profileUrl,
        secUserId: existingByProfileUrl.secUserId ?? data.secUserId,
      };
    }
    if (existingByProfileUrl && existingByProfileUrl.deletedAt !== null) {
      throw new AppError(
        "BENCHMARK_ARCHIVED",
        "该对标博主已被归档，请前往归档列表查看",
        409,
      );
    }

    const benchmark = await this.createBenchmarkWithMember(caller, data);

    return {
      id: benchmark.id,
      profileUrl: benchmark.profileUrl,
      secUserId: benchmark.secUserId ?? data.secUserId,
    };
  }

  async listBenchmarks(
    caller: SessionUser,
    params: ListBenchmarksParams,
  ): Promise<PaginatedData<BenchmarkAccountDTO>> {
    const result = await benchmarkAccountRepository.findMany({
      organizationId: this.resolveOrganizationScope(caller),
      page: params.page,
      limit: params.limit,
      archiveFilter: params.archiveFilter ?? "active",
    });

    const items = await Promise.all(
      result.items.map(async (item) => ({
        ...mapBenchmarkAccountToDto(item),
        canArchive: await benchmarkAccountRepository.hasMember(item.id, caller.id),
      })),
    );

    return {
      ...result,
      items,
    };
  }

  async listArchivedBenchmarks(
    caller: SessionUser,
    params: ListParams,
  ): Promise<PaginatedData<BenchmarkAccountDTO>> {
    return this.listBenchmarks(caller, {
      page: params.page,
      limit: params.limit,
      archiveFilter: "archived",
    });
  }

  async getBenchmarkDetail(
    caller: SessionUser,
    id: string,
  ): Promise<BenchmarkAccountDetailDTO> {
    const account = await benchmarkAccountRepository.findById(id);

    if (!account) {
      throw new AppError("NOT_FOUND", "对标账号不存在", 404);
    }

    if (
      caller.role !== UserRole.SUPER_ADMIN &&
      account.organizationId !== caller.organizationId
    ) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    return {
      ...mapBenchmarkAccountDetailToDto(account),
      canArchive: await benchmarkAccountRepository.hasMember(account.id, caller.id),
    };
  }

  async archiveBenchmark(
    caller: SessionUser,
    id: string,
  ): Promise<{ id: string; deletedAt: string }> {
    const account = await benchmarkAccountRepository.findById(id);

    if (!account || account.deletedAt !== null) {
      throw new AppError("NOT_FOUND", "对标账号不存在", 404);
    }

    if (
      caller.role !== UserRole.SUPER_ADMIN &&
      account.organizationId !== caller.organizationId
    ) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    const isMember = await benchmarkAccountRepository.hasMember(account.id, caller.id);
    if (!isMember) {
      throw new AppError("FORBIDDEN", "仅关联员工可归档该对标账号", 403);
    }

    const archived = await benchmarkAccountRepository.archive(id);

    return {
      id: archived.id,
      deletedAt: archived.deletedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async listBenchmarkVideos(
    caller: SessionUser,
    benchmarkId: string,
    params: ListParams,
  ): Promise<Awaited<ReturnType<typeof benchmarkVideoRepository.findByAccountId>>> {
    await this.getBenchmarkDetail(caller, benchmarkId);

    return benchmarkVideoRepository.findByAccountId({
      accountId: benchmarkId,
      page: params.page,
      limit: params.limit,
    });
  }

  private resolveOrganizationScope(caller: SessionUser): string | undefined {
    this.assertSupportedCaller(caller);
    return caller.role === UserRole.SUPER_ADMIN ? undefined : caller.organizationId;
  }

  private assertSupportedCaller(caller: SessionUser): void {
    if (
      caller.role !== UserRole.EMPLOYEE &&
      caller.role !== UserRole.BRANCH_MANAGER &&
      caller.role !== UserRole.SUPER_ADMIN
    ) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }
  }

  private async createBenchmarkWithMember(
    caller: SessionUser,
    data: CreateDouyinAccountData,
  ) {
    try {
      return await benchmarkAccountRepository.createWithMember(
        {
          ...data,
          createdByUserId: caller.id,
          organizationId: caller.organizationId,
        },
        BenchmarkAccountMemberSource.MANUAL,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await benchmarkAccountRepository.findByOrganizationAndSecUserIdIncludingDeleted(
          caller.organizationId,
          data.secUserId,
        );
        if (existing?.deletedAt) {
          throw new AppError(
            "BENCHMARK_ARCHIVED",
            "该对标博主已被归档，请前往归档列表查看",
            409,
          );
        }
        if (existing) {
          await benchmarkAccountRepository.upsertMember({
            benchmarkAccountId: existing.id,
            userId: caller.id,
            organizationId: caller.organizationId,
            source: BenchmarkAccountMemberSource.MANUAL,
          });
          return existing;
        }
      }

      throw error;
    }
  }

}

export const benchmarkAccountService = new BenchmarkAccountService();
