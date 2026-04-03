import { DouyinAccountType, UserRole } from "@prisma/client";

import { AppError } from "@/lib/errors";
import type { AccountPreview } from "@/types/douyin-account";
import type { SessionUser } from "@/server/services/user.service";
import { crawlerService } from "@/server/services/crawler.service";
import { douyinAccountRepository } from "@/server/repositories/douyin-account.repository";
import { douyinVideoRepository } from "@/server/repositories/douyin-video.repository";

interface CreateDouyinAccountData {
  profileUrl: string;
  secUserId: string;
  nickname: string;
  avatar: string;
  bio?: string | null;
  followersCount: number;
  videosCount: number;
}

interface ListParams {
  page: number;
  limit: number;
}

class DouyinAccountService {
  async previewAccount(caller: SessionUser, profileUrl: string): Promise<AccountPreview> {
    if (caller.role !== UserRole.EMPLOYEE) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    const secUserId = await crawlerService.getSecUserId(profileUrl);
    const profile = await crawlerService.fetchUserProfile(secUserId);

    return {
      profileUrl,
      secUserId,
      nickname: profile.nickname,
      avatar: profile.avatar,
      bio: profile.bio,
      followersCount: profile.followersCount,
      videosCount: profile.videosCount,
    };
  }

  async createAccount(caller: SessionUser, data: CreateDouyinAccountData) {
    if (caller.role !== UserRole.EMPLOYEE) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    const existing = await douyinAccountRepository.findByProfileUrl(data.profileUrl);
    if (existing) {
      throw new AppError("ACCOUNT_EXISTS", "该账号已被添加", 409);
    }

    return douyinAccountRepository.create({
      ...data,
      userId: caller.id,
      organizationId: caller.organizationId,
      type: DouyinAccountType.MY_ACCOUNT,
    });
  }

  async listAccounts(caller: SessionUser, params: ListParams) {
    switch (caller.role) {
      case UserRole.EMPLOYEE:
        return douyinAccountRepository.findMany({
          userId: caller.id,
          page: params.page,
          limit: params.limit,
        });
      case UserRole.BRANCH_MANAGER:
        return douyinAccountRepository.findMany({
          organizationId: caller.organizationId,
          page: params.page,
          limit: params.limit,
        });
      case UserRole.SUPER_ADMIN:
        return douyinAccountRepository.findMany({
          page: params.page,
          limit: params.limit,
        });
      default:
        throw new AppError("FORBIDDEN", "无操作权限", 403);
    }
  }

  async getAccountDetail(caller: SessionUser, id: string) {
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

    return account;
  }

  async listVideos(caller: SessionUser, accountId: string, params: ListParams) {
    await this.getAccountDetail(caller, accountId);

    return douyinVideoRepository.findByAccountId({
      accountId,
      page: params.page,
      limit: params.limit,
    });
  }
}

export const douyinAccountService = new DouyinAccountService();
