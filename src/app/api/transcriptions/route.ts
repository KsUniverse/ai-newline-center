import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";
import { handleApiError, successResponse } from "@/lib/api-response";
import { transcriptionService } from "@/server/services/transcription.service";

const createTranscriptionSchema = z.object({
  videoId: z.string().cuid(),
});

const getTranscriptionByVideoSchema = z.object({
  videoId: z.string().cuid(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const body = await request.json();
    const data = createTranscriptionSchema.parse(body);
    const result = await transcriptionService.createTranscription(data.videoId, session.user);

    return successResponse(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const query = getTranscriptionByVideoSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await transcriptionService.getByVideoId(query.videoId, session.user);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
