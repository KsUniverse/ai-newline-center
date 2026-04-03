import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { syncService } from "@/server/services/sync.service";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE);

    const { id } = paramsSchema.parse(await context.params);
    const result = await syncService.syncAccount(id, session.user.id, session.user.organizationId);

    return successResponse({
      lastSyncedAt: result.lastSyncedAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
