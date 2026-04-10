import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { rewriteService } from "@/server/services/rewrite.service";

const generateRewriteSchema = z.object({
  targetAccountId: z.string().cuid(),
  modelConfigId: z.string().cuid(),
  usedFragmentIds: z.array(z.string().cuid()).default([]),
  userInputContent: z.string().max(500).optional(),
});

interface RouteParams {
  params: Promise<{ videoId: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const { videoId } = await params;
    const body = await request.json();
    const input = generateRewriteSchema.parse(body);

    const result = await rewriteService.generate(videoId, input, session.user);
    return successResponse(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
