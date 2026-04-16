import { BenchmarkVideoTag, UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { benchmarkVideoService } from "@/server/services/benchmark-video.service";

const querySchema = z.object({
  dateRange: z.enum(["today", "yesterday", "this_week"]).default("today"),
  customTag: z.nativeEnum(BenchmarkVideoTag).optional(),
  isBringOrder: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.EMPLOYEE);

    const params = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const result = await benchmarkVideoService.listDashboardVideos(session.user, {
      dateRange: params.dateRange,
      customTag: params.customTag,
      isBringOrder: params.isBringOrder,
      cursor: params.cursor,
      limit: params.limit,
    });

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
