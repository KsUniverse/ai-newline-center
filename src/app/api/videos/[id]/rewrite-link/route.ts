import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { videoService } from "@/server/services/video.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const linkBodySchema = z.object({
  rewriteId: z.string().min(1),
});

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE);

    const { id: videoId } = await params;
    const link = await videoService.getRewriteLink(videoId, session.user);
    return successResponse(link);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE);

    const { id: videoId } = await params;
    const body = linkBodySchema.parse(await request.json());

    const link = await videoService.linkRewrite(videoId, body.rewriteId, session.user);
    return successResponse(link);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE);

    const { id: videoId } = await params;
    await videoService.unlinkRewrite(videoId, session.user);
    return successResponse({ unlinked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
