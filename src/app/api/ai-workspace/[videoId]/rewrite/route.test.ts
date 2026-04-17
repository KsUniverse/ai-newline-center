import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, getOrNullByWorkspaceMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getOrNullByWorkspaceMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/rewrite.service", () => ({
  rewriteService: {
    getOrNullByWorkspace: getOrNullByWorkspaceMock,
  },
}));

describe("GET /api/ai-workspace/[videoId]/rewrite", () => {
  beforeEach(() => {
    authMock.mockReset();
    getOrNullByWorkspaceMock.mockReset();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    authMock.mockResolvedValue(null);

    const { GET } = await import(
      "@/app/api/ai-workspace/[videoId]/rewrite/route"
    );
    const response = await GET(
      new Request("http://localhost/api/ai-workspace/video_1/rewrite") as never,
      { params: Promise.resolve({ videoId: "video_1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 200 with rewrite: null when no rewrite exists", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        account: "employee",
        name: "员工A",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    getOrNullByWorkspaceMock.mockResolvedValue(null);

    const { GET } = await import(
      "@/app/api/ai-workspace/[videoId]/rewrite/route"
    );
    const response = await GET(
      new Request("http://localhost/api/ai-workspace/video_1/rewrite") as never,
      { params: Promise.resolve({ videoId: "video_1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, data: { rewrite: null } });
  });

  it("returns 200 with rewrite data when rewrite exists", async () => {
    const mockRewrite = {
      id: "rw_1",
      workspaceId: "ws_1",
      targetAccountId: null,
      organizationId: "org_1",
      userId: "user_1",
      createdAt: "2026-04-11T00:00:00.000Z",
      updatedAt: "2026-04-11T00:00:00.000Z",
      versions: [],
      targetAccount: null,
    };
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        account: "employee",
        name: "员工A",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    getOrNullByWorkspaceMock.mockResolvedValue(mockRewrite);

    const { GET } = await import(
      "@/app/api/ai-workspace/[videoId]/rewrite/route"
    );
    const response = await GET(
      new Request("http://localhost/api/ai-workspace/video_1/rewrite") as never,
      { params: Promise.resolve({ videoId: "video_1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, data: { rewrite: mockRewrite } });
    expect(getOrNullByWorkspaceMock).toHaveBeenCalledWith(
      "video_1",
      expect.objectContaining({ id: "user_1" }),
    );
  });
});
