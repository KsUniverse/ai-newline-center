import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, syncAccountMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  syncAccountMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/sync.service", () => ({
  syncService: {
    syncAccount: syncAccountMock,
  },
}));

describe("POST /api/douyin-accounts/[id]/sync", () => {
  beforeEach(() => {
    authMock.mockReset();
    syncAccountMock.mockReset();
  });

  it("returns 401 when the user is not logged in", async () => {
    authMock.mockResolvedValue(null);

    const { POST } = await import("@/app/api/douyin-accounts/[id]/sync/route");
    const response = await POST(new NextRequest("http://localhost/api/douyin-accounts/ck123/sync"), {
      params: Promise.resolve({ id: "cm8v0h7i50000v1a0abc12345" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 when a non-employee triggers manual sync", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "manager_1",
        role: UserRole.BRANCH_MANAGER,
      },
    });

    const { POST } = await import("@/app/api/douyin-accounts/[id]/sync/route");
    const response = await POST(new NextRequest("http://localhost/api/douyin-accounts/ck123/sync"), {
      params: Promise.resolve({ id: "cm8v0h7i50000v1a0abc12345" }),
    });

    expect(response.status).toBe(403);
  });

  it("returns the updated sync time for employees", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    syncAccountMock.mockResolvedValue({
      lastSyncedAt: new Date("2026-04-03T00:00:00.000Z"),
    });

    const { POST } = await import("@/app/api/douyin-accounts/[id]/sync/route");
    const response = await POST(new NextRequest("http://localhost/api/douyin-accounts/ck123/sync"), {
      params: Promise.resolve({ id: "cm8v0h7i50000v1a0abc12345" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        lastSyncedAt: "2026-04-03T00:00:00.000Z",
      },
    });
    expect(syncAccountMock).toHaveBeenCalledWith("cm8v0h7i50000v1a0abc12345", "user_1", "org_1");
  });
});
