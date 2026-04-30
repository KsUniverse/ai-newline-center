import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { videoService } from "@/server/services/video.service";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE);

    const { id: videoId } = await params;
    const { days } = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const snapshots = await videoService.getSnapshots(videoId, session.user, days);
    return successResponse(snapshots);
  } catch (error) {
    return handleApiError(error);
  }
}
