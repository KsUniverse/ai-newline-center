import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { handleApiError, successResponse } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

describe("api-response helpers", () => {
  it("builds a successful API response", async () => {
    const response = successResponse({ ok: true }, 201);

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store, no-cache, must-revalidate");
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { ok: true },
    });
  });

  it("maps ZodError to a validation response", async () => {
    const schema = z.object({
      account: z.string().min(1, "账号不能为空"),
    });

    let validationError: unknown;

    try {
      schema.parse({ account: "" });
    } catch (error) {
      validationError = error;
    }

    const response = handleApiError(validationError);

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store, no-cache, must-revalidate");
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "账号不能为空",
      },
    });
  });

  it("maps AppError to its configured status and message", async () => {
    const response = handleApiError(new AppError("UNAUTHORIZED", "未登录", 401));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store, no-cache, must-revalidate");
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "未登录",
      },
    });
  });

  it("maps unknown errors to an internal error response", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = handleApiError(new Error("boom"));

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store, no-cache, must-revalidate");
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "服务器内部错误",
      },
    });
    consoleErrorSpy.mockRestore();
  });
});
