import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { benchmarkAccountService } from "@/server/services/benchmark-account.service";

const createBenchmarkSchema = z.object({
  profileUrl: z
    .string()
    .url()
    .regex(/^https?:\/\/(www\.)?douyin\.com\/user\/.+$/, "请输入合法的抖音主页链接"),
  secUserId: z.string().min(1),
  nickname: z.string().min(1).max(200),
  avatar: z.string().url(),
  bio: z.string().max(500).nullable().optional(),
  signature: z.string().max(500).nullable().optional(),
  followersCount: z.number().int().min(0),
  followingCount: z.number().int().min(0),
  likesCount: z.number().int().min(0),
  videosCount: z.number().int().min(0),
  douyinNumber: z.string().max(100).nullable().optional(),
  ipLocation: z.string().max(100).nullable().optional(),
  age: z.number().int().min(0).nullable().optional(),
  province: z.string().max(100).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  verificationLabel: z.string().max(200).nullable().optional(),
  verificationIconUrl: z.string().url().nullable().optional(),
  verificationType: z.number().int().nullable().optional(),
});

const listBenchmarksSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE);

    const params = listBenchmarksSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const result = await benchmarkAccountService.listBenchmarks(session.user, params);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE);

    const body = await request.json();
    const data = createBenchmarkSchema.parse(body);
    const account = await benchmarkAccountService.createBenchmark(session.user, data);

    return successResponse(account, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
