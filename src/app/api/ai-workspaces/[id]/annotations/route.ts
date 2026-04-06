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
  segmentId: z.string().cuid().nullable().optional(),
  startOffset: z.number().int(),
  endOffset: z.number().int(),
  quotedText: z.string().min(1),
  function: z.string().nullable().optional(),
  argumentRole: z.string().nullable().optional(),
  technique: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  effectiveness: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const { id } = workspaceIdSchema.parse(await context.params);
    const body = await request.json();
    const data = bodySchema.parse(body);
    const result = await aiWorkspaceService.saveAnnotation(id, session.user, data);
    return successResponse(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

