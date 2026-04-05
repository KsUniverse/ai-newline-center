import { describe, expect, it } from "vitest";

import {
  normalizeBenchmarkAccount,
  normalizeBenchmarkAccounts,
  normalizeBenchmarkAccountDetail,
  type BenchmarkAccountDTO,
  type BenchmarkAccountDetailDTO,
} from "@/types/douyin-account";

const benchmarkDto: BenchmarkAccountDTO = {
  id: "benchmark_1",
  profileUrl: "https://www.douyin.com/user/target",
  secUserId: "sec_target",
  nickname: "共享样本",
  avatar: "https://cdn.example.com/avatar.jpg",
  bio: null,
  signature: null,
  followersCount: 1000,
  followingCount: 10,
  likesCount: 2000,
  videosCount: 88,
  douyinNumber: null,
  ipLocation: null,
  age: null,
  province: null,
  city: null,
  verificationLabel: null,
  verificationIconUrl: null,
  verificationType: null,
  loginStatus: "NOT_LOGGED_IN",
  loginStateUpdatedAt: null,
  loginStateCheckedAt: null,
  loginStateExpiresAt: null,
  loginErrorMessage: null,
  userId: "creator_1",
  organizationId: "org_1",
  createdAt: "2026-04-05T00:00:00.000Z",
  creatorName: "最初录入人",
  deletedAt: null,
  canArchive: true,
};

describe("benchmark account normalization", () => {
  it("converts record creator user id into a display-only semantic field", () => {
    const normalized = normalizeBenchmarkAccount(benchmarkDto);

    expect(normalized.createdByUserId).toBe("creator_1");
    expect("userId" in normalized).toBe(false);
  });

  it("normalizes benchmark lists to remove ambiguous creator user ids", () => {
    const normalized = normalizeBenchmarkAccounts([benchmarkDto]);

    expect(normalized[0]?.createdByUserId).toBe("creator_1");
    expect(normalized[0] && "userId" in normalized[0]).toBe(false);
  });

  it("keeps detail-only fields while normalizing creator user id", () => {
    const normalized = normalizeBenchmarkAccountDetail({
      ...benchmarkDto,
      lastSyncedAt: "2026-04-05T08:00:00.000Z",
    } satisfies BenchmarkAccountDetailDTO);

    expect(normalized.createdByUserId).toBe("creator_1");
    expect(normalized.lastSyncedAt).toBe("2026-04-05T08:00:00.000Z");
  });
});