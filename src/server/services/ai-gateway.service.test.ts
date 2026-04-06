import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createOpenAIMock,
  findByStepMock,
  generateTextMock,
} = vi.hoisted(() => ({
  createOpenAIMock: vi.fn(),
  findByStepMock: vi.fn(),
  generateTextMock: vi.fn(),
}));

const envMock = {
  NODE_ENV: "development",
  ARK_API_KEY: "ark_test_key",
  ARK_BASE_URL: "https://ark.example.com",
  ARK_TRANSCRIBE_MODEL: "ark/transcribe",
  ARK_DECOMPOSE_MODEL: "ark/decompose",
  ARK_REWRITE_MODEL: "ark/rewrite",
} as const;

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

vi.mock("@/server/repositories/ai-step-binding.repository", () => ({
  aiStepBindingRepository: {
    findByStep: findByStepMock,
  },
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: createOpenAIMock,
}));

vi.mock("ai", () => ({
  generateText: generateTextMock,
}));

describe("aiGateway", () => {
  beforeEach(() => {
    findByStepMock.mockReset();
    createOpenAIMock.mockReset();
    generateTextMock.mockReset();

    createOpenAIMock.mockReturnValue({
      model: vi.fn(),
    });
    generateTextMock.mockResolvedValue({
      text: "generated text",
    });
  });

  it("lists registry implementations with availability metadata", async () => {
    const { aiGateway } = await import("@/server/services/ai-gateway.service");

    const implementations = aiGateway.listImplementations();

    expect(implementations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "ark-default",
          name: "Ark Default",
          available: true,
          supportedSteps: ["TRANSCRIBE", "DECOMPOSE", "REWRITE"],
        }),
      ]),
    );
  });

  it("generates text using the configured step binding", async () => {
    findByStepMock.mockResolvedValue({
      step: "DECOMPOSE",
      implementationKey: "ark-default",
    });

    const { aiGateway } = await import("@/server/services/ai-gateway.service");
    const result = await aiGateway.generateText("DECOMPOSE", "hello world");

    expect(findByStepMock).toHaveBeenCalledWith("DECOMPOSE");
    expect(createOpenAIMock).toHaveBeenCalledWith({
      apiKey: "ark_test_key",
      baseURL: "https://ark.example.com",
    });
    expect(generateTextMock).toHaveBeenCalled();
    expect(result).toEqual({
      implementationKey: "ark-default",
      modelId: "ark/decompose",
      text: "generated text",
    });
  });

  it("rejects unavailable implementations before generation", async () => {
    const originalKey = envMock.ARK_API_KEY;
    Object.defineProperty(envMock, "ARK_API_KEY", { value: "", writable: true });
    findByStepMock.mockResolvedValue({
      step: "REWRITE",
      implementationKey: "ark-default",
    });

    const { aiGateway } = await import("@/server/services/ai-gateway.service");

    await expect(aiGateway.generateText("REWRITE", "hello world")).rejects.toMatchObject({
      code: "AI_IMPLEMENTATION_UNAVAILABLE",
    });

    Object.defineProperty(envMock, "ARK_API_KEY", { value: originalKey, writable: true });
  });
});
