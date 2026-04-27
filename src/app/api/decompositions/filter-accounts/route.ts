import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { handleApiError, successResponse } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { aiWorkspaceService } from "@/server/services/ai-workspace.service";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const accounts = await aiWorkspaceService.listDecompositionFilterAccounts(session.user);
    return successResponse(accounts);
  } catch (error) {
    return handleApiError(error);
  }
}
