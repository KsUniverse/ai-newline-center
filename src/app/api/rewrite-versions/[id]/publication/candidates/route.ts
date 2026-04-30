import { UserRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { rewritePublicationService } from "@/server/services/rewrite-publication.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE);

    const { id } = await params;
    const candidates = await rewritePublicationService.listPublicationCandidates(id, session.user);
    return successResponse(candidates);
  } catch (error) {
    return handleApiError(error);
  }
}
