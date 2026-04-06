import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { aiWorkspaceService } from "@/server/services/ai-workspace.service";

const bodySchema = z.object({
  videoId: z.string().cuid(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const body = await request.json();
    const data = bodySchema.parse(body);
    const result = await aiWorkspaceService.startTranscription(session.user, data.videoId);
    return successResponse(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

