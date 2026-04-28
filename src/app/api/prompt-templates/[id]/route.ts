import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { promptTemplateService } from "@/server/services/prompt-template.service";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  systemContent: z.string().min(1).nullable().optional(),
  content: z.string().min(1).optional(),
  modelConfigId: z.string().cuid().nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const { id } = await params;
    const data = await promptTemplateService.getById(id);
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const { id } = await params;
    const body: unknown = await request.json();
    const input = updateSchema.parse(body);

    const data = await promptTemplateService.update(id, input);
    return successResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const { id } = await params;
    await promptTemplateService.delete(id);
    return successResponse(null, 204);
  } catch (error) {
    return handleApiError(error);
  }
}
