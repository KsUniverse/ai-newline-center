import type { AccountPreview } from "@/types/douyin-account";

export interface CreateDouyinAccountPayload {
  profileUrl: string;
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

function clampNonNegative(value: number): number {
  return value < 0 ? 0 : value;
}

function normalizeNullableAge(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  return value < 0 ? null : value;
}

export function toCreateDouyinAccountPayload(
  preview: AccountPreview,
): CreateDouyinAccountPayload {
  return {
    profileUrl: preview.profileUrl,
    secUserId: preview.secUserId,
    nickname: preview.nickname,
    avatar: preview.avatar,
    bio: preview.bio,
    signature: preview.signature,
    followersCount: clampNonNegative(preview.followersCount),
    followingCount: clampNonNegative(preview.followingCount),
    likesCount: clampNonNegative(preview.likesCount),
    videosCount: clampNonNegative(preview.videosCount),
    douyinNumber: preview.douyinNumber,
    ipLocation: preview.ipLocation,
    age: normalizeNullableAge(preview.age),
    province: preview.province,
    city: preview.city,
    verificationLabel: preview.verificationLabel,
    verificationIconUrl: preview.verificationIconUrl,
    verificationType: preview.verificationType,
  };
}
