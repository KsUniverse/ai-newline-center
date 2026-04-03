import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

import { handleApiError, successResponse } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
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

    if (!session?.user) {
      throw new AppError("UNAUTHORIZED", "请先登录", 401);
    }

    if (session.user.role !== UserRole.EMPLOYEE) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    const { id } = paramsSchema.parse(await context.params);
    const result = await syncService.syncAccount(id, session.user.id, session.user.organizationId);

    return successResponse({
      lastSyncedAt: result.lastSyncedAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
