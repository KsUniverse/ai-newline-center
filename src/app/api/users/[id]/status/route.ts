import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { userService } from "@/server/services/user.service";

const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER);

    const { id } = await context.params;
    const body = await request.json();
    const data = updateUserStatusSchema.parse(body);
    const user = await userService.setUserStatus(session.user, id, data.status);

    return successResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}
