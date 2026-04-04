import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/errors";
import type { ApiResponse } from "@/types/api";

const API_RESPONSE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export function successResponse<T>(data: T, status: number = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      data,
    },
    {
      status,
      headers: API_RESPONSE_HEADERS,
    },
  );
}

export function handleApiError(error: unknown): NextResponse<ApiResponse<never>> {
  if (error instanceof ZodError) {
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "请求参数验证失败",
        },
      },
      {
        status: 400,
        headers: API_RESPONSE_HEADERS,
      },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      {
        status: error.statusCode,
        headers: API_RESPONSE_HEADERS,
      },
    );
  }

  console.error("Unhandled error:", error);

  return NextResponse.json<ApiResponse<never>>(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "服务器内部错误",
      },
    },
    {
      status: 500,
      headers: API_RESPONSE_HEADERS,
    },
  );
}
