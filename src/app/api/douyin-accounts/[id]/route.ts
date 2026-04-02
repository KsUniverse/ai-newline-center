import { UserRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { douyinAccountService } from "@/server/services/douyin-account.service";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE);

    const { id } = await context.params;
    const account = await douyinAccountService.getAccountDetail(session.user, id);

    return successResponse(account);
  } catch (error) {
    return handleApiError(error);
  }
}
