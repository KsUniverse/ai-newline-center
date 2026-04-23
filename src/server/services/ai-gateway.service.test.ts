import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createOpenAIMock,
  createChatCompletionsMock,
  findByIdRawMock,
  findByStepMock,
  generateTextMock,
  streamTextMock,
} = vi.hoisted(() => ({
  createOpenAIMock: vi.fn(),
  createChatCompletionsMock: vi.fn(),
  findByIdRawMock: vi.fn(),
  findByStepMock: vi.fn(),
  generateTextMock: vi.fn(),
  streamTextMock: vi.fn(),
}));

vi.mock("@/server/repositories/ai-step-binding.repository", () => ({
  aiStepBindingRepository: {
    findByStep: findByStepMock,
  },
}));

vi.mock("@/server/repositories/ai-model-config.repository", () => ({
  aiModelConfigRepository: {
    findByIdRaw: findByIdRawMock,
  },
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: createOpenAIMock,
}));

vi.mock("ai", () => ({
  generateText: generateTextMock,
  streamText: streamTextMock,
}));

vi.mock("openai", () => ({
  default: class {
    chat = {
      completions: {
        create: createChatCompletionsMock,
      },
    };
  },
}));

const textConfig = {
  id: "config_2",
  name: "Ark 文本",
  baseUrl: "https://ark.example.com",
  apiKey: "ark_test_key",
  modelName: "ark/decompose",
  videoInputMode: "NONE",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const transcriptionConfig = {
  id: "config_3",
  name: "Qwen 视频",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: "dashscope_test_key",
  modelName: "qwen3-vl-plus",
  videoInputMode: "OSS_FILE",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("aiGateway", () => {
  beforeEach(() => {
    createOpenAIMock.mockReset();
    createChatCompletionsMock.mockReset();
    findByIdRawMock.mockReset();
    findByStepMock.mockReset();
    generateTextMock.mockReset();
    streamTextMock.mockReset();

    createOpenAIMock.mockReturnValue(vi.fn().mockReturnValue("mock-model"));
    generateTextMock.mockResolvedValue({ text: "generated text" });
  });

  it("streams text using the configured step binding", async () => {
    findByStepMock.mockResolvedValue({ step: "REWRITE", modelConfigId: "config_2" });
    findByIdRawMock.mockResolvedValue(textConfig);
    streamTextMock.mockResolvedValue({
      textStream: (async function* () {
        yield "逐";
        yield "字";
      })(),
    });

    const { aiGateway } = await import("@/server/services/ai-gateway.service");
    const result = await aiGateway.streamText("REWRITE", "stream this");

    const chunks: string[] = [];
    for await (const chunk of result.textStream) {
      chunks.push(chunk);
    }

    expect(findByStepMock).toHaveBeenCalledWith("REWRITE");
    expect(findByIdRawMock).toHaveBeenCalledWith("config_2");
    expect(streamTextMock).toHaveBeenCalled();
    expect(result.modelConfigId).toBe("config_2");
    expect(result.modelName).toBe("ark/decompose");
    expect(chunks).toEqual(["逐", "字"]);
  });

  it("streams transcription deltas using the configured TRANSCRIBE binding", async () => {
    findByStepMock.mockResolvedValue({ step: "TRANSCRIBE", modelConfigId: "config_3" });
    findByIdRawMock.mockResolvedValue(transcriptionConfig);
    createChatCompletionsMock.mockResolvedValue(
      (async function* () {
        yield {
          choices: [
            {
              delta: {
                content: "第一段",
              },
            },
          ],
        };
        yield {
          choices: [
            {
              delta: {
                content: "第二段",
              },
            },
          ],
        };
      })(),
    );

    const { aiGateway } = await import("@/server/services/ai-gateway.service");
    const result = await aiGateway.streamTranscriptionFromVideo("https://oss.example.com/demo.mp4");

    const chunks: string[] = [];
    for await (const chunk of result.textStream) {
      chunks.push(chunk);
    }

    expect(findByStepMock).toHaveBeenCalledWith("TRANSCRIBE");
    expect(findByIdRawMock).toHaveBeenCalledWith("config_3");
    expect(createChatCompletionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "qwen3-vl-plus",
        stream: true,
      }),
    );
    expect(result.modelConfigId).toBe("config_3");
    expect(result.modelName).toBe("qwen3-vl-plus");
    expect(chunks).toEqual(["第一段", "第二段"]);
  });

  it("generates text using the configured step binding", async () => {
    findByStepMock.mockResolvedValue({ step: "DECOMPOSE", modelConfigId: "config_2" });
    findByIdRawMock.mockResolvedValue(textConfig);

    const { aiGateway } = await import("@/server/services/ai-gateway.service");
    const result = await aiGateway.generateText("DECOMPOSE", "hello world");

    expect(findByStepMock).toHaveBeenCalledWith("DECOMPOSE");
    expect(findByIdRawMock).toHaveBeenCalledWith("config_2");
    expect(createOpenAIMock).toHaveBeenCalledWith({
      apiKey: "ark_test_key",
      baseURL: "https://ark.example.com",
    });
    expect(generateTextMock).toHaveBeenCalled();
    expect(result).toEqual({
      modelConfigId: "config_2",
      modelName: "ark/decompose",
      text: "generated text",
    });
  });

  it("rejects using the pure-text entry for transcription", async () => {
    const { aiGateway } = await import("@/server/services/ai-gateway.service");

    await expect(aiGateway.generateText("TRANSCRIBE", "share url prompt")).rejects.toMatchObject({
      code: "AI_TRANSCRIBE_INPUT_MISMATCH",
    });
  });

  it("rejects when the step has no binding configured", async () => {
    findByStepMock.mockResolvedValue({ step: "REWRITE", modelConfigId: null });

    const { aiGateway } = await import("@/server/services/ai-gateway.service");

    await expect(aiGateway.generateText("REWRITE", "hello")).rejects.toMatchObject({
      code: "AI_STEP_NOT_CONFIGURED",
    });
  });
});
