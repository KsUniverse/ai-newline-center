import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { douyinAccountService } from "@/server/services/douyin-account.service";

const listVideosSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE);

    const { id } = await context.params;
    const params = listVideosSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const result = await douyinAccountService.listVideos(session.user, id, params);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
