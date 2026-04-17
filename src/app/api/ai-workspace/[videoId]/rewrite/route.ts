import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { rewriteService } from "@/server/services/rewrite.service";

interface RouteParams {
  params: Promise<{ videoId: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const { videoId } = await params;
    const rewrite = await rewriteService.getOrNullByWorkspace(videoId, session.user);
    return successResponse({ rewrite });
  } catch (error) {
    return handleApiError(error);
  }
}
