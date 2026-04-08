import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { aiModelConfigRepository } from "@/server/repositories/ai-model-config.repository";

const updateModelConfigSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).nullable().optional(),
  modelName: z.string().min(1).max(128).optional(),
  videoInputMode: z.enum(["NONE", "OSS_FILE", "GOOGLE_FILE"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const { id } = await params;
    const body = await request.json();
    const data = updateModelConfigSchema.parse(body);
    const result = await aiModelConfigRepository.update(id, data);
    if (!result) throw new AppError("AI_MODEL_NOT_FOUND", "模型配置不存在", 404);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const { id } = await params;
    const deleted = await aiModelConfigRepository.delete(id);
    if (!deleted) throw new AppError("AI_MODEL_NOT_FOUND", "模型配置不存在", 404);
    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
