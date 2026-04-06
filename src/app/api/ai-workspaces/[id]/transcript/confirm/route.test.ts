import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, confirmTranscriptMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  confirmTranscriptMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/ai-workspace.service", () => ({
  aiWorkspaceService: {
    confirmTranscript: confirmTranscriptMock,
  },
}));

describe("POST /api/ai-workspaces/[id]/transcript/confirm", () => {
  beforeEach(() => {
    authMock.mockReset();
    confirmTranscriptMock.mockReset();
  });

  it("confirms the transcript for the validated workspace id", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        account: "employee",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    confirmTranscriptMock.mockResolvedValue({
      id: "workspace_1",
      status: "TRANSCRIPT_CONFIRMED",
    });

    const { POST } = await import("@/app/api/ai-workspaces/[id]/transcript/confirm/route");
    const response = await POST(new Request("http://localhost/api/ai-workspaces/workspace_1/transcript/confirm") as never, {
      params: Promise.resolve({
        id: "ckv1234567890123456789012",
      }),
    });

    expect(response.status).toBe(200);
    expect(confirmTranscriptMock).toHaveBeenCalledWith(
      "ckv1234567890123456789012",
      expect.objectContaining({ id: "user_1" }),
    );
  });
});