import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { videoService } from "@/server/services/video.service";

const listVideosSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  accountId: z.string().optional(),
  tag: z.string().optional(),
  sort: z.enum(["publishedAt", "likeCount"]).default("publishedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE);

    const params = listVideosSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const result = await videoService.listVideos(session.user, params);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
