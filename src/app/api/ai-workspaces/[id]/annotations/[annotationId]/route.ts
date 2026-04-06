import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { aiWorkspaceService } from "@/server/services/ai-workspace.service";

const routeSchema = z.object({
  id: z.string().cuid(),
  annotationId: z.string().cuid(),
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
    annotationId: string;
  }>;
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const { id, annotationId } = routeSchema.parse(await context.params);
    const body = await request.json();
    const data = bodySchema.parse(body);
    const result = await aiWorkspaceService.updateAnnotation(id, annotationId, session.user, data);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const { id, annotationId } = routeSchema.parse(await context.params);
    const result = await aiWorkspaceService.deleteAnnotation(id, annotationId, session.user);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

