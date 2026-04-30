import { UserRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { rewriteService } from "@/server/services/rewrite.service";

export async function GET() {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE);

    const items = await rewriteService.listMineWithFinalVersion(session.user);
    return successResponse(items);
  } catch (error) {
    return handleApiError(error);
  }
}
