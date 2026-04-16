import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  getWorkspaceByIdMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getWorkspaceByIdMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/ai-workspace.service", () => ({
  aiWorkspaceService: {
    getWorkspaceById: getWorkspaceByIdMock,
  },
}));

vi.mock("@/lib/redis", () => ({
  createPubSubRedisClient: vi.fn(() => ({
    subscribe: vi.fn(),
    on: vi.fn(),
    quit: vi.fn(),
  })),
}));

describe("GET /api/ai-workspaces/[id]/transcript/sse", () => {
  beforeEach(() => {
    authMock.mockReset();
    getWorkspaceByIdMock.mockReset();
  });

  it("returns an immediate done event when the transcript already exists", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        account: "employee",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    getWorkspaceByIdMock.mockResolvedValue({
      id: "workspace_1",
      status: "TRANSCRIPT_DRAFT",
      transcript: {
        currentText: "完整转录稿",
      },
    });

    const { GET } = await import("@/app/api/ai-workspaces/[id]/transcript/sse/route");
    const response = await GET(
      new Request("http://localhost/api/ai-workspaces/workspace_1/transcript/sse"),
      {
        params: Promise.resolve({
          id: "ckv1234567890123456789012",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    await expect(response.text()).resolves.toContain("event: done");
  });
});
