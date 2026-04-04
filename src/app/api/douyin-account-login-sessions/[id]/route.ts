import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { douyinAuthService } from "@/server/services/douyin-auth.service";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE);

    const { id } = paramsSchema.parse(await context.params);
    const loginSession = await douyinAuthService.getSession(session.user, id);

    return successResponse(loginSession);
  } catch (error) {
    return handleApiError(error);
  }
}