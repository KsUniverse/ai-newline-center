import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, startTranscriptionMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  startTranscriptionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/ai-workspace.service", () => ({
  aiWorkspaceService: {
    startTranscription: startTranscriptionMock,
  },
}));

describe("POST /api/ai-workspaces/transcribe", () => {
  beforeEach(() => {
    authMock.mockReset();
    startTranscriptionMock.mockReset();
  });

  it("starts workspace transcription with the validated video id", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        account: "employee",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    startTranscriptionMock.mockResolvedValue({
      id: "workspace_1",
      status: "TRANSCRIBING",
    });

    const { POST } = await import("@/app/api/ai-workspaces/transcribe/route");
    const response = await POST(
      new Request("http://localhost/api/ai-workspaces/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId: "ckv1234567890123456789012",
        }),
      }) as never,
    );

    expect(response.status).toBe(201);
    expect(startTranscriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user_1" }),
      "ckv1234567890123456789012",
    );
  });
});