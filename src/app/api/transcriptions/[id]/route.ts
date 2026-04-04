import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";
import { handleApiError, successResponse } from "@/lib/api-response";
import { transcriptionService } from "@/server/services/transcription.service";

const updateTranscriptionSchema = z.object({
  editedText: z.string().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const { id } = await params;
    const result = await transcriptionService.getById(id, session.user);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const { id } = await params;
    const body = await request.json();
    const data = updateTranscriptionSchema.parse(body);
    const result = await transcriptionService.updateEditedText(id, data.editedText, session.user);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
