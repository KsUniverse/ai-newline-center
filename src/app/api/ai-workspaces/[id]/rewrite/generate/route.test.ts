import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  buildGeneratedRewritePromptMock,
  streamTextMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  buildGeneratedRewritePromptMock: vi.fn(),
  streamTextMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/ai-workspace.service", () => ({
  aiWorkspaceService: {
    buildGeneratedRewritePrompt: buildGeneratedRewritePromptMock,
  },
}));

vi.mock("@/server/services/ai-gateway.service", () => ({
  aiGateway: {
    streamText: streamTextMock,
  },
}));

describe("POST /api/ai-workspaces/[id]/rewrite/generate", () => {
  beforeEach(() => {
    authMock.mockReset();
    buildGeneratedRewritePromptMock.mockReset();
    streamTextMock.mockReset();
  });

  it("streams AI rewrite deltas for the validated workspace", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        account: "employee",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    });
    buildGeneratedRewritePromptMock.mockResolvedValue("rewrite prompt");
    streamTextMock.mockResolvedValue({
      modelConfigId: "config_2",
      modelName: "ark/rewrite",
      textStream: (async function* () {
        yield "开头";
        yield "收尾";
      })(),
    });

    const { POST } = await import("@/app/api/ai-workspaces/[id]/rewrite/generate/route");
    const response = await POST(
      new Request("http://localhost/api/ai-workspaces/workspace_1/rewrite/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentDraft: "",
          selectedViewpoints: ["观点一", "观点二"],
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
    await expect(response.text()).resolves.toContain("event: done");
    expect(buildGeneratedRewritePromptMock).toHaveBeenCalledWith(
      "ckv1234567890123456789012",
      expect.objectContaining({ id: "user_1" }),
      {
        currentDraft: "",
        selectedViewpoints: ["观点一", "观点二"],
      },
    );
    expect(streamTextMock).toHaveBeenCalledWith("REWRITE", "rewrite prompt");
  });
});
