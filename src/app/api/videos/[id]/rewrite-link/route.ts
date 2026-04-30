import { UserRole } from "@prisma/client";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { videoService } from "@/server/services/video.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

    await params;
    void request;
    void session;
    throw new AppError(
      "VIDEO_LINK_ENTRY_DEPRECATED",
      "请前往仿写版本区域使用新的“关联已发布视频”入口",
      410,
    );
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
