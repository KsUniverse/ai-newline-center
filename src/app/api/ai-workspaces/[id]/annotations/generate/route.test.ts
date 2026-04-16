import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  buildGeneratedAnnotationPromptMock,
  streamTextMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  buildGeneratedAnnotationPromptMock: vi.fn(),
  streamTextMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/ai-workspace.service", () => ({
  aiWorkspaceService: {
    buildGeneratedAnnotationPrompt: buildGeneratedAnnotationPromptMock,
  },
}));

vi.mock("@/server/services/ai-gateway.service", () => ({
  aiGateway: {
    streamText: streamTextMock,
  },
}));

describe("POST /api/ai-workspaces/[id]/annotations/generate", () => {
  beforeEach(() => {
    authMock.mockReset();
    buildGeneratedAnnotationPromptMock.mockReset();
    streamTextMock.mockReset();
  });

  it("streams AI decomposition deltas for a validated selection", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        account: "employee",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    buildGeneratedAnnotationPromptMock.mockResolvedValue("prompt");
    streamTextMock.mockResolvedValue({
      modelConfigId: "config_1",
      modelName: "ark/decompose",
      textStream: (async function* () {
        yield "第一句";
        yield "第二句";
      })(),
    });

    const { POST } = await import("@/app/api/ai-workspaces/[id]/annotations/generate/route");
    const response = await POST(
      new Request("http://localhost/api/ai-workspaces/workspace_1/annotations/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startOffset: 0,
          endOffset: 10,
          quotedText: "原文片段",
        }),
      }) as never,
      {
        params: Promise.resolve({
          id: "ckv1234567890123456789012",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    await expect(response.text()).resolves.toContain("event: delta");
    expect(buildGeneratedAnnotationPromptMock).toHaveBeenCalledWith(
      "ckv1234567890123456789012",
      expect.objectContaining({ id: "user_1" }),
      expect.objectContaining({ quotedText: "原文片段" }),
    );
    expect(streamTextMock).toHaveBeenCalledWith("DECOMPOSE", "prompt");
  });
});
