import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, successResponse } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { rewriteService } from "@/server/services/rewrite.service";

const saveDirectEditedContentSchema = z.object({
  editedContent: z.string().max(10_000),
});

interface RouteParams {
  params: Promise<{ rewriteId: string; versionId: string }>;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const { rewriteId, versionId } = await params;
    const body = await request.json();
    const { editedContent } = saveDirectEditedContentSchema.parse(body);
    const result = await rewriteService.saveDirectVersionEdit(
      rewriteId,
      versionId,
      editedContent,
      session.user,
    );

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
