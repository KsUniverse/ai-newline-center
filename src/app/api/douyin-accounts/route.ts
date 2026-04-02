import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { douyinAccountService } from "@/server/services/douyin-account.service";

const createAccountSchema = z.object({
  profileUrl: z
    .string()
    .url()
    .regex(/^https?:\/\/(www\.)?douyin\.com\/user\/.+$/, "请输入合法的抖音主页链接"),
  nickname: z.string().min(1).max(200),
  avatar: z.string().url(),
  bio: z.string().max(500).nullable().optional(),
  followersCount: z.number().int().min(0),
  videosCount: z.number().int().min(0),
});

const listAccountsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE);

    const params = listAccountsSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const result = await douyinAccountService.listAccounts(session.user, params);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE);

    const body = await request.json();
    const data = createAccountSchema.parse(body);
    const account = await douyinAccountService.createAccount(session.user, data);

    return successResponse(account, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
