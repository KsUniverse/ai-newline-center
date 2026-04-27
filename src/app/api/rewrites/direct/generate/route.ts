import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, successResponse } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { rewriteService } from "@/server/services/rewrite.service";

const directGenerateSchema = z.object({
  rewriteId: z.string().cuid().optional(),
  targetAccountId: z.string().cuid(),
  modelConfigId: z.string().cuid(),
  usedFragmentIds: z.array(z.string().cuid()).default([]),
  userInputContent: z.string().max(2000).optional(),
  topic: z.string().trim().min(1).max(500),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const body = await request.json();
    const input = directGenerateSchema.parse(body);
    const result = await rewriteService.generateDirect(input, session.user);

    return successResponse(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
