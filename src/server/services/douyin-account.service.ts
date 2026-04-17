import {
  DouyinAccountLoginStatus,
  type DouyinVideo,
  type Prisma,
  type PrismaClient,
  UserRole,
  type DouyinAccount,
} from "@prisma/client";

import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type {
  AccountPreview,
  DouyinAccountDTO,
  DouyinAccountDetailDTO,
} from "@/types/douyin-account";
import type { PaginatedData } from "@/types/api";
import type { SessionUser } from "@/types/session";
import {
  douyinAccountRepository,
} from "@/server/repositories/douyin-account.repository";
import { douyinVideoRepository } from "@/server/repositories/douyin-video.repository";
import { crawlerService } from "@/server/services/crawler.service";
import {
  mapCrawlerProfileToPreview,
  mapDouyinAccountDetailToDto,
  mapDouyinAccountToDto,
} from "@/server/services/douyin-account.mapper";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export interface CreateDouyinAccountData {
  profileUrl: string;
  secUserId: string;
  nickname: string;
  avatar: string;
  bio?: string | null;
  signature?: string | null;
  followersCount: number;
  followingCount: number;
  likesCount: number;
  videosCount: number;
  douyinNumber?: string | null;
  ipLocation?: string | null;
  age?: number | null;
  province?: string | null;
  city?: string | null;
  verificationLabel?: string | null;
  verificationIconUrl?: string | null;
  verificationType?: number | null;
  loginStatus?: DouyinAccountLoginStatus;
  loginStateUpdatedAt?: Date | null;
  loginStateCheckedAt?: Date | null;
  loginStateExpiresAt?: Date | null;
  loginErrorMessage?: string | null;
  favoriteCookieHeader?: string | null;
  lastSyncedAt?: Date | null;
}

interface CreateLoggedInAccountOptions {
  accountId?: string;
  loginStatePath?: string | null;
  db?: DatabaseClient;
}

export interface ListParams {
  page: number;
  limit: number;
}

class DouyinAccountService {
  private ensureEmployee(caller: SessionUser): void {
    if (caller.role !== UserRole.EMPLOYEE) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }
  }

  private async ensureAccountDoesNotExist(
    data: Pick<CreateDouyinAccountData, "profileUrl" | "secUserId">,
    db: DatabaseClient = prisma,
  ): Promise<void> {
    const existing = await douyinAccountRepository.findByProfileUrl(data.profileUrl, false, db);
    if (existing) {
      throw new AppError("ACCOUNT_EXISTS", "该账号已被添加", 409);
    }

    const existingBySecUserId = await douyinAccountRepository.findBySecUserIdIncludingDeleted(
      data.secUserId,
      db,
    );
    if (existingBySecUserId) {
      throw new AppError("ACCOUNT_EXISTS", "该账号已被添加", 409);
    }
  }

  async previewAccount(caller: SessionUser, profileUrl: string): Promise<AccountPreview> {
    this.ensureEmployee(caller);

    const secUserId = await crawlerService.getSecUserId(profileUrl);
    const profile = await crawlerService.fetchUserProfile(secUserId);

    return mapCrawlerProfileToPreview(profileUrl, profile);
  }

  async createAccount(caller: SessionUser, data: CreateDouyinAccountData): Promise<DouyinAccountDTO> {
    this.ensureEmployee(caller);

    await this.ensureAccountDoesNotExist(data);

    const createdAccount = await douyinAccountRepository.create({
      ...data,
      userId: caller.id,
      organizationId: caller.organizationId,
    });

    return mapDouyinAccountToDto(createdAccount);
  }

  async createLoggedInAccount(
    caller: SessionUser,
    data: CreateDouyinAccountData,
    options: CreateLoggedInAccountOptions = {},
  ): Promise<DouyinAccount> {
    this.ensureEmployee(caller);

    const db = options.db ?? prisma;
    await this.ensureAccountDoesNotExist(data, db);

    return douyinAccountRepository.create({
      id: options.accountId,
      ...data,
      userId: caller.id,
      organizationId: caller.organizationId,
      loginStatus: data.loginStatus ?? DouyinAccountLoginStatus.LOGGED_IN,
      loginStatePath: options.loginStatePath ?? null,
      loginStateUpdatedAt: data.loginStateUpdatedAt ?? null,
      loginStateCheckedAt: data.loginStateCheckedAt ?? null,
      loginStateExpiresAt: data.loginStateExpiresAt ?? null,
      loginErrorMessage: data.loginErrorMessage ?? null,
      favoriteCookieHeader: data.favoriteCookieHeader ?? null,
      lastSyncedAt: data.lastSyncedAt ?? null,
    }, db);
  }

  async listAccounts(
    caller: SessionUser,
    params: ListParams,
  ): Promise<PaginatedData<DouyinAccountDTO>> {
    const result = await this.resolveAccountsPage(caller, params);
    return {
      ...result,
      items: result.items.map((item) => mapDouyinAccountToDto(item)),
    };
  }

  private resolveAccountsPage(
    caller: SessionUser,
    params: ListParams,
  ): ReturnType<typeof douyinAccountRepository.findMany> {
    switch (caller.role) {
      case UserRole.EMPLOYEE:
        return douyinAccountRepository.findMany({ userId: caller.id, ...params });
      case UserRole.BRANCH_MANAGER:
        return douyinAccountRepository.findMany({ organizationId: caller.organizationId, ...params });
      case UserRole.SUPER_ADMIN:
        return douyinAccountRepository.findMany(params);
      default:
        throw new AppError("FORBIDDEN", "无操作权限", 403);
    }
  }

  async getOwnAccountForRelogin(caller: SessionUser, id: string): Promise<DouyinAccount> {
    this.ensureEmployee(caller);

    const account = await douyinAccountRepository.findOwnedMyAccount(
      id,
      caller.id,
      caller.organizationId,
    );

    if (!account) {
      throw new AppError("NOT_FOUND", "账号不存在", 404);
    }

    return account;
  }

  async getAccountDetail(caller: SessionUser, id: string): Promise<DouyinAccountDetailDTO> {
    const account = await douyinAccountRepository.findById(id);

    if (!account) {
      throw new AppError("NOT_FOUND", "账号不存在", 404);
    }

    if (caller.role === UserRole.EMPLOYEE && account.userId !== caller.id) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    if (
      caller.role === UserRole.BRANCH_MANAGER &&
      account.organizationId !== caller.organizationId
    ) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    return mapDouyinAccountDetailToDto(account);
  }

  async listVideos(
    caller: SessionUser,
    accountId: string,
    params: ListParams,
  ): Promise<PaginatedData<DouyinVideo>> {
    await this.getAccountDetail(caller, accountId);

    return douyinVideoRepository.findByAccountId({
      accountId,
      page: params.page,
      limit: params.limit,
    });
  }
}

export const douyinAccountService = new DouyinAccountService();
