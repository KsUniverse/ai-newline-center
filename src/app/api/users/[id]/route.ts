import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { userService } from "@/server/services/user.service";

const updateUserSchema = z
  .object({
    name: z.string().min(1, "姓名不能为空").max(50, "姓名不能超过 50 位").optional(),
    role: z.nativeEnum(UserRole).optional(),
  })
  .refine((data) => data.name !== undefined || data.role !== undefined, {
    message: "至少提供一个更新字段",
  });

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER);

    const { id } = await context.params;
    const user = await userService.getUserById(session.user, id);

    return successResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER);

    const { id } = await context.params;
    const body = await request.json();
    const data = updateUserSchema.parse(body);
    const user = await userService.updateUser(session.user, id, data);

    return successResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}
