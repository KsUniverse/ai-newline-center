import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { aiWorkspaceService } from "@/server/services/ai-workspace.service";

const workspaceIdSchema = z.object({
  id: z.string().cuid(),
});

const bodySchema = z.object({
  currentDraft: z.string(),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const { id } = workspaceIdSchema.parse(await context.params);
    const body = await request.json();
    const data = bodySchema.parse(body);
    const result = await aiWorkspaceService.saveRewriteDraft(id, session.user, data);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

