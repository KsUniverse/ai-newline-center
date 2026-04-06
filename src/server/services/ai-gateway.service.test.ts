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
  TRANSCRIBE_BASE_URL: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  TRANSCRIBE_API_KEY: "transcribe_test_key",
  TRANSCRIBE_MODEL_NAME: "doubao-seed-2-0-lite-260215",
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
    vi.stubGlobal("fetch", vi.fn());

    createOpenAIMock.mockReturnValue(vi.fn().mockReturnValue("mock-model"));
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
          key: "volcengine-transcribe",
          name: "火山引擎转录",
          available: true,
          supportedSteps: ["TRANSCRIBE"],
        }),
        expect.objectContaining({
          key: "ark-decompose",
          name: "Ark 拆解",
          available: true,
          supportedSteps: ["DECOMPOSE"],
        }),
      ]),
    );
  });

  it("generates text using the configured step binding", async () => {
    findByStepMock.mockResolvedValue({
      step: "DECOMPOSE",
      implementationKey: "ark-decompose",
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
      implementationKey: "ark-decompose",
      modelId: "ark/decompose",
      text: "generated text",
    });
  });

  it("calls the dedicated transcription endpoint for transcription", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "转录正文" } }],
      }),
    } as Response);
    findByStepMock.mockResolvedValue({
      step: "TRANSCRIBE",
      implementationKey: "volcengine-transcribe",
    });

    const { aiGateway } = await import("@/server/services/ai-gateway.service");
    const result = await aiGateway.generateText("TRANSCRIBE", "share url prompt");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result).toEqual({
      implementationKey: "volcengine-transcribe",
      modelId: "doubao-seed-2-0-lite-260215",
      text: "转录正文",
    });
  });

  it("rejects unavailable implementations before generation", async () => {
    const originalKey = envMock.ARK_API_KEY;
    Object.defineProperty(envMock, "ARK_API_KEY", { value: "", writable: true });
    findByStepMock.mockResolvedValue({
      step: "REWRITE",
      implementationKey: "ark-rewrite",
    });

    const { aiGateway } = await import("@/server/services/ai-gateway.service");

    await expect(aiGateway.generateText("REWRITE", "hello world")).rejects.toMatchObject({
      code: "AI_IMPLEMENTATION_UNAVAILABLE",
    });

    Object.defineProperty(envMock, "ARK_API_KEY", { value: originalKey, writable: true });
  });
});
