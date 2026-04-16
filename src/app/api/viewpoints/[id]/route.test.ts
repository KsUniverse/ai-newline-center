import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, deleteFragmentMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  deleteFragmentMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/fragment.service", () => ({
  fragmentService: {
    deleteFragment: deleteFragmentMock,
  },
}));

describe("DELETE /api/viewpoints/[id]", () => {
  beforeEach(() => {
    authMock.mockReset();
    deleteFragmentMock.mockReset();
  });

  it("delegates delete to the fragment service with a validated id", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        name: "Alice",
        account: "alice",
        role: UserRole.SUPER_ADMIN,
        organizationId: "org_1",
      },
    });
    deleteFragmentMock.mockResolvedValue({
      id: "cm8v0h7i50000v1a0abc12345",
    });

    const { DELETE } = await import("@/app/api/viewpoints/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/viewpoints/cm8v0h7i50000v1a0abc12345"), {
      params: Promise.resolve({ id: "cm8v0h7i50000v1a0abc12345" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        id: "cm8v0h7i50000v1a0abc12345",
      },
    });
    expect(deleteFragmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user_1",
        account: "alice",
        organizationId: "org_1",
      }),
      "cm8v0h7i50000v1a0abc12345",
    );
  });

  it("returns 400 for a non-cuid fragment id from the route params", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        name: "Alice",
        account: "alice",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    deleteFragmentMock.mockResolvedValue({
      id: "fragment-123",
    });

    const { DELETE } = await import("@/app/api/viewpoints/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/viewpoints/fragment-123"), {
      params: Promise.resolve({ id: "fragment-123" }),
    });

    expect(response.status).toBe(400);
    expect(deleteFragmentMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    authMock.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/viewpoints/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/viewpoints/cm8v0h7i50000v1a0abc12345"), {
      params: Promise.resolve({ id: "cm8v0h7i50000v1a0abc12345" }),
    });

    expect(response.status).toBe(401);
  });
});
