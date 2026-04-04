import { UserRole } from "@prisma/client";

import { AppError } from "@/lib/errors";
import {
  douyinAccountRepository,
  type DouyinBenchmarkWithUser,
  type FindManyBenchmarksParams,
} from "@/server/repositories/douyin-account.repository";
import { douyinVideoRepository } from "@/server/repositories/douyin-video.repository";
import { crawlerService } from "@/server/services/crawler.service";
import type { SessionUser } from "@/server/services/user.service";
import {
  mapCrawlerProfileToPreview,
  type CreateDouyinAccountData,
  type ListParams,
} from "@/server/services/douyin-account.service";
import type {
  BenchmarkAccountDTO,
  BenchmarkAccountDetailDTO,
  AccountPreview,
} from "@/types/douyin-account";
import type { PaginatedData } from "@/types/api";

type BenchmarkArchiveFilter = NonNullable<FindManyBenchmarksParams["archiveFilter"]>;

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

    const existingBySecUserId = await douyinAccountRepository.findBySecUserIdIncludingDeleted(
      data.secUserId,
    );
    if (existingBySecUserId && existingBySecUserId.deletedAt === null) {
      throw new AppError("BENCHMARK_EXISTS", "该对标博主已存在", 409);
    }
    if (existingBySecUserId && existingBySecUserId.deletedAt !== null) {
      throw new AppError(
        "BENCHMARK_ARCHIVED",
        "该对标博主已被归档，请前往归档列表查看",
        409,
      );
    }

    const existingByProfileUrl = await douyinAccountRepository.findByProfileUrl(
      data.profileUrl,
      true,
    );
    if (existingByProfileUrl?.type === "MY_ACCOUNT") {
      throw new AppError("ACCOUNT_EXISTS_AS_MY", "该账号已作为我的账号被添加", 409);
    }

    const benchmark = await douyinAccountRepository.createBenchmark({
      ...data,
      userId: caller.id,
      organizationId: caller.organizationId,
    });

    return {
      id: benchmark.id,
      profileUrl: benchmark.profileUrl,
      secUserId: data.secUserId,
    };
  }

  async listBenchmarks(
    caller: SessionUser,
    params: ListBenchmarksParams,
  ): Promise<PaginatedData<BenchmarkAccountDTO>> {
    const result = await douyinAccountRepository.findManyBenchmarks({
      organizationId: this.resolveOrganizationScope(caller),
      page: params.page,
      limit: params.limit,
      archiveFilter: params.archiveFilter ?? "active",
    });

    return {
      ...result,
      items: result.items.map((item) => this.toBenchmarkAccountDTO(item)),
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
    const account = await douyinAccountRepository.findBenchmarkById(id);

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
      ...this.toBenchmarkAccountDTO(account),
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
    };
  }

  async archiveBenchmark(
    caller: SessionUser,
    id: string,
  ): Promise<{ id: string; deletedAt: string }> {
    const account = await douyinAccountRepository.findBenchmarkById(id);

    if (!account || account.deletedAt !== null) {
      throw new AppError("NOT_FOUND", "对标账号不存在", 404);
    }

    if (account.userId !== caller.id) {
      throw new AppError("FORBIDDEN", "只能归档自己创建的对标账号", 403);
    }

    const archived = await douyinAccountRepository.archiveBenchmark(id);

    return {
      id: archived.id,
      deletedAt: archived.deletedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async listBenchmarkVideos(caller: SessionUser, benchmarkId: string, params: ListParams) {
    await this.getBenchmarkDetail(caller, benchmarkId);

    return douyinVideoRepository.findByAccountId({
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

  private toBenchmarkAccountDTO(account: DouyinBenchmarkWithUser): BenchmarkAccountDTO {
    return {
      id: account.id,
      profileUrl: account.profileUrl,
      secUserId: account.secUserId,
      nickname: account.nickname,
      avatar: account.avatar,
      bio: account.bio,
      signature: account.signature,
      followersCount: account.followersCount,
      followingCount: account.followingCount,
      likesCount: account.likesCount,
      videosCount: account.videosCount,
      douyinNumber: account.douyinNumber,
      ipLocation: account.ipLocation,
      age: account.age,
      province: account.province,
      city: account.city,
      verificationLabel: account.verificationLabel,
      verificationIconUrl: account.verificationIconUrl,
      verificationType: account.verificationType,
      type: account.type,
      loginStatus: account.loginStatus,
      loginStateUpdatedAt: account.loginStateUpdatedAt?.toISOString() ?? null,
      loginStateCheckedAt: account.loginStateCheckedAt?.toISOString() ?? null,
      loginStateExpiresAt: account.loginStateExpiresAt?.toISOString() ?? null,
      loginErrorMessage: account.loginErrorMessage,
      userId: account.userId,
      organizationId: account.organizationId,
      createdAt: account.createdAt.toISOString(),
      creatorName: account.user.name,
      deletedAt: account.deletedAt?.toISOString() ?? null,
    };
  }
}

export const benchmarkAccountService = new BenchmarkAccountService();
