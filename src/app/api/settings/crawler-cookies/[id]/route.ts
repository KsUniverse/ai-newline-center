import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { crawlerCookieService } from "@/server/services/crawler-cookie.service";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const { id } = await params;
    const result = await crawlerCookieService.delete(id, session.user.organizationId);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
