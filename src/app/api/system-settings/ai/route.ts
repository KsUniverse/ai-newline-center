import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { aiSettingsService } from "@/server/services/ai-settings.service";

const updateSettingsSchema = z.object({
  steps: z
    .array(
      z.object({
        step: z.enum(["TRANSCRIBE", "DECOMPOSE", "REWRITE"]),
        implementationKey: z.string().min(1).nullable(),
      }),
    )
    .optional(),
  bindings: z
    .array(
      z.object({
        step: z.enum(["TRANSCRIBE", "DECOMPOSE", "REWRITE"]),
        implementationKey: z.string().min(1).nullable(),
      }),
    )
    .optional(),
}).refine((value) => Boolean(value.steps?.length || value.bindings?.length), {
  message: "至少提供一组 AI 步骤绑定",
});

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const result = await aiSettingsService.getSettings(session.user);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

async function updateSettings(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const body = await request.json();
    const data = updateSettingsSchema.parse(body);
    const result = await aiSettingsService.updateSettings(session.user, data);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return updateSettings(request);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return updateSettings(request);
}
