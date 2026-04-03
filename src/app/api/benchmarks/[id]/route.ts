import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { benchmarkAccountService } from "@/server/services/benchmark-account.service";

const benchmarkIdSchema = z.object({
  id: z.string().cuid(),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE);

    const { id } = benchmarkIdSchema.parse(await context.params);
    const detail = await benchmarkAccountService.getBenchmarkDetail(session.user, id);

    return successResponse(detail);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE);

    const { id } = benchmarkIdSchema.parse(await context.params);
    const result = await benchmarkAccountService.archiveBenchmark(session.user, id);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
