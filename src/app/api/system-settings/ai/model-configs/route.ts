import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { handleApiError, successResponse } from "@/lib/api-response";
import { aiModelConfigRepository } from "@/server/repositories/ai-model-config.repository";

const createModelConfigSchema = z.object({
  name: z.string().min(1).max(64),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  modelName: z.string().min(1).max(128),
  videoInputMode: z.enum(["NONE", "DASHSCOPE_FILE", "GOOGLE_FILE"]),
});

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const result = await aiModelConfigRepository.findAll();
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    requireRole(session, UserRole.SUPER_ADMIN);

    const body = await request.json();
    const data = createModelConfigSchema.parse(body);
    const result = await aiModelConfigRepository.create(data);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
