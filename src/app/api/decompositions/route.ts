import { UserRole } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, successResponse } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { aiWorkspaceService } from "@/server/services/ai-workspace.service";

const listDecompositionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN);

    const { searchParams } = new URL(request.url);
    const { cursor, limit } = listDecompositionsQuerySchema.parse({
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const benchmarkAccountIds = searchParams.getAll("benchmarkAccountIds");
    const hasAnnotationsRaw = searchParams.get("hasAnnotations");
    const hasAnnotations =
      hasAnnotationsRaw === "true" ? true : hasAnnotationsRaw === "false" ? false : undefined;

    const result = await aiWorkspaceService.listDecompositions(session.user, {
      cursor,
      limit,
      benchmarkAccountIds: benchmarkAccountIds.length > 0 ? benchmarkAccountIds : undefined,
      hasAnnotations,
    });

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
