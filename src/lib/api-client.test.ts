import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiClient } from "@/lib/api-client";

describe("apiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends GET requests with no-store caching by default", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { ok: true },
      }),
    } as Response);

    const result = await apiClient.get<{ ok: boolean }>("/douyin-accounts?page=1&limit=20");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/douyin-accounts?page=1&limit=20", {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("maps failed API payloads to ApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "ACCOUNT_EXISTS",
          message: "该账号已被添加",
        },
      }),
    } as Response);

    await expect(apiClient.get("/douyin-accounts?page=1&limit=20")).rejects.toEqual(
      new ApiError("ACCOUNT_EXISTS", "该账号已被添加"),
    );
  });
});