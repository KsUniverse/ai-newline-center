import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { handleApiError, successResponse } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { AppError } from "@/lib/errors";
import { rewriteService } from "@/server/services/rewrite.service";

interface RouteParams {
  params: Promise<{ videoId: string; versionId: string }>;
}

export async function PATCH(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const { videoId, versionId } = await params;
    const rewrite = await rewriteService.getOrNullByWorkspace(videoId, session.user);
    if (!rewrite) {
      throw new AppError("REWRITE_NOT_FOUND", "仿写任务不存在", 404);
    }

    const result = await rewriteService.setFinalVersion(rewrite.id, versionId, session.user);
    return successResponse({ version: result });
  } catch (error) {
    return handleApiError(error);
  }
}
