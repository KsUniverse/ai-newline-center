import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { userService } from "@/server/services/user.service";

const createUserSchema = z.object({
  account: z
    .string()
    .min(3, "账号至少 3 位")
    .max(50, "账号不能超过 50 位")
    .regex(/^[a-zA-Z0-9_]+$/, "账号只能包含字母、数字和下划线"),
  password: z.string().min(6, "密码至少 6 位").max(100, "密码不能超过 100 位"),
  name: z.string().min(1, "姓名不能为空").max(50, "姓名不能超过 50 位"),
  role: z.nativeEnum(UserRole),
  organizationId: z.string().min(1, "组织不能为空"),
});

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  organizationId: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER);

    const query = listUsersQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const result = await userService.listUsers(session.user, query);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER);

    const body = await request.json();
    const data = createUserSchema.parse(body);
    const user = await userService.createUser(session.user, data);

    return successResponse(user, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
