import type { DouyinAccount } from "@prisma/client";

import type {
  AccountPreview,
  BenchmarkAccountDTO,
  BenchmarkAccountDetailDTO,
  DouyinAccountDTO,
  DouyinAccountDetailDTO,
} from "@/types/douyin-account";
import type { DouyinAccountWithUser } from "@/server/repositories/douyin-account.repository";
import type { BenchmarkAccountWithCreator } from "@/server/repositories/benchmark-account.repository";

interface AccountProfilePreviewSource {
  secUserId: string;
  nickname: string;
  avatar: string;
  bio: string | null;
  signature: string | null;
  followersCount: number;
  followingCount: number;
  likesCount: number;
  videosCount: number;
  douyinNumber: string | null;
  ipLocation: string | null;
  age: number | null;
  province: string | null;
  city: string | null;
  verificationLabel: string | null;
  verificationIconUrl: string | null;
  verificationType: number | null;
}

export function mapCrawlerProfileToPreview(
  profileUrl: string,
  profile: AccountProfilePreviewSource,
): AccountPreview {
  return {
    profileUrl,
    secUserId: profile.secUserId,
    nickname: profile.nickname,
    avatar: profile.avatar,
    bio: profile.bio,
    signature: profile.signature,
    followersCount: profile.followersCount,
    followingCount: profile.followingCount,
    likesCount: profile.likesCount,
    videosCount: profile.videosCount,
    douyinNumber: profile.douyinNumber,
    ipLocation: profile.ipLocation,
    age: profile.age,
    province: profile.province,
    city: profile.city,
    verificationLabel: profile.verificationLabel,
    verificationIconUrl: profile.verificationIconUrl,
    verificationType: profile.verificationType,
  };
}

export function mapDouyinAccountToDto(account: DouyinAccount): DouyinAccountDTO {
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
    loginStatus: account.loginStatus,
    loginStateUpdatedAt: account.loginStateUpdatedAt?.toISOString() ?? null,
    loginStateCheckedAt: account.loginStateCheckedAt?.toISOString() ?? null,
    loginStateExpiresAt: account.loginStateExpiresAt?.toISOString() ?? null,
    loginErrorMessage: account.loginErrorMessage,
    userId: account.userId,
    organizationId: account.organizationId,
    createdAt: account.createdAt.toISOString(),
  };
}

export function mapDouyinAccountDetailToDto(
  account: DouyinAccountWithUser,
): DouyinAccountDetailDTO {
  return {
    ...mapDouyinAccountToDto(account),
    user: account.user,
    lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
  };
}

export function mapBenchmarkAccountToDto(
  account: BenchmarkAccountWithCreator,
): BenchmarkAccountDTO {
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
    loginStatus: "NOT_LOGGED_IN",
    loginStateUpdatedAt: null,
    loginStateCheckedAt: null,
    loginStateExpiresAt: null,
    loginErrorMessage: null,
    userId: account.createdByUserId,
    organizationId: account.organizationId,
    createdAt: account.createdAt.toISOString(),
    creatorName: account.createdByUser.name,
    deletedAt: account.deletedAt?.toISOString() ?? null,
    canArchive: false,
  };
}

export function mapBenchmarkAccountDetailToDto(
  account: BenchmarkAccountWithCreator,
): BenchmarkAccountDetailDTO {
  return {
    ...mapBenchmarkAccountToDto(account),
    lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
  };
}