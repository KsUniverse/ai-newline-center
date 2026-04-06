import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { aiWorkspaceService } from "@/server/services/ai-workspace.service";

const querySchema = z.object({
  videoId: z.string().cuid(),
});

const bodySchema = z.object({
  videoId: z.string().cuid(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const data = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await aiWorkspaceService.getWorkspace(data.videoId, session.user);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const body = await request.json();
    const data = bodySchema.parse(body);
    const result = await aiWorkspaceService.ensureWorkspace(data.videoId, session.user);
    return successResponse(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

