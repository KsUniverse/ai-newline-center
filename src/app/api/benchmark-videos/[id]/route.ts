import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { benchmarkVideoService } from "@/server/services/benchmark-video.service";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE);

    const { id } = paramsSchema.parse(await context.params);
    const result = await benchmarkVideoService.getVideoDetail(session.user, id);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
