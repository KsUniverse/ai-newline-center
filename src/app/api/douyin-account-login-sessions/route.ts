import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { douyinAuthService } from "@/server/services/douyin-auth.service";

const createLoginSessionSchema = z.discriminatedUnion("purpose", [
  z.object({
    purpose: z.literal("CREATE_ACCOUNT"),
  }),
  z.object({
    purpose: z.literal("RELOGIN"),
    accountId: z.string().cuid(),
  }),
]);

export async function POST(request: Request) {
  try {
    const session = await auth();
    requireRole(session, UserRole.EMPLOYEE);

    const body = await request.json();
    const data = createLoginSessionSchema.parse(body);
    const loginSession = await douyinAuthService.createSession(session.user, data);

    return successResponse(loginSession, 201);
  } catch (error) {
    return handleApiError(error);
  }
}