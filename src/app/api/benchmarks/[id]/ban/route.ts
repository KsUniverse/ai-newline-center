import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { benchmarkAccountService } from "@/server/services/benchmark-account.service";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

const bodySchema = z.object({
  isBanned: z.boolean(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE);

    const { id } = paramsSchema.parse(await context.params);
    const body = await request.json();
    const { isBanned } = bodySchema.parse(body);

    const result = await benchmarkAccountService.toggleBanStatus(session.user, id, isBanned);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
