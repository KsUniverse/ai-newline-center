import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { aiSettingsService } from "@/server/services/ai-settings.service";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const result = await aiSettingsService.getSettingsReadOnly();
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
