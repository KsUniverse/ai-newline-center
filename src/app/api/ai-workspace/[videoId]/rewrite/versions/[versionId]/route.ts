import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { rewriteService } from "@/server/services/rewrite.service";

const saveEditedContentSchema = z.object({
  editedContent: z.string().max(10_000),
});

interface RouteParams {
  params: Promise<{ videoId: string; versionId: string }>;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const { videoId, versionId } = await params;
    const body = await request.json();
    const { editedContent } = saveEditedContentSchema.parse(body);

    const result = await rewriteService.saveEditedContent(
      videoId,
      versionId,
      editedContent,
      session.user,
    );
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
