import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findAllBindingsMock,
  findAllConfigsMock,
  replaceAllMock,
} = vi.hoisted(() => ({
  findAllBindingsMock: vi.fn(),
  findAllConfigsMock: vi.fn(),
  replaceAllMock: vi.fn(),
}));

vi.mock("@/server/repositories/ai-step-binding.repository", () => ({
  aiStepBindingRepository: {
    findAll: findAllBindingsMock,
    replaceAll: replaceAllMock,
  },
}));

vi.mock("@/server/repositories/ai-model-config.repository", () => ({
  aiModelConfigRepository: {
    findAll: findAllConfigsMock,
  },
}));

const adminUser = {
  id: "user_1",
  account: "admin",
  role: UserRole.SUPER_ADMIN,
  organizationId: "org_1",
};

const stubConfigs = [
  {
    id: "config_1",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    apiKeyMasked: "**test**",
    modelName: "gemini-2.0-flash",
    videoInputMode: "GOOGLE_FILE",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "config_2",
    name: "Ark 文本",
    baseUrl: "https://ark.example.com",
    apiKeyMasked: "**ark**",
    modelName: "ark/text",
    videoInputMode: "NONE",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("aiSettingsService", () => {
  beforeEach(() => {
    findAllBindingsMock.mockReset();
    findAllConfigsMock.mockReset();
    replaceAllMock.mockReset();

    findAllConfigsMock.mockResolvedValue(stubConfigs);
  });

  it("returns bindings and model config pool for super admin", async () => {
    findAllBindingsMock.mockResolvedValue([
      { step: "TRANSCRIBE", modelConfigId: "config_1" },
      { step: "DECOMPOSE", modelConfigId: null },
      { step: "REWRITE", modelConfigId: null },
    ]);

    const { aiSettingsService } = await import("@/server/services/ai-settings.service");
    const result = await aiSettingsService.getSettings(adminUser);

    expect(result.bindings).toHaveLength(3);
    expect(result.modelConfigs).toHaveLength(2);
    expect(result.bindings.find((b) => b.step === "TRANSCRIBE")?.modelConfigId).toBe("config_1");
    expect(result.bindings.find((b) => b.step === "DECOMPOSE")?.modelConfigId).toBeNull();
  });

  it("persists updated bindings", async () => {
    replaceAllMock.mockResolvedValue(undefined);
    findAllBindingsMock.mockResolvedValue([
      { step: "TRANSCRIBE", modelConfigId: "config_1" },
      { step: "DECOMPOSE", modelConfigId: "config_2" },
      { step: "REWRITE", modelConfigId: null },
    ]);

    const { aiSettingsService } = await import("@/server/services/ai-settings.service");
    await aiSettingsService.updateSettings(adminUser, {
      bindings: [
        { step: "TRANSCRIBE", modelConfigId: "config_1" },
        { step: "DECOMPOSE", modelConfigId: "config_2" },
        { step: "REWRITE", modelConfigId: null },
      ],
    });

    expect(replaceAllMock).toHaveBeenCalledWith([
      { step: "TRANSCRIBE", modelConfigId: "config_1" },
      { step: "DECOMPOSE", modelConfigId: "config_2" },
      { step: "REWRITE", modelConfigId: null },
    ]);
  });

  it("fills unspecified steps with null when replacing bindings", async () => {
    replaceAllMock.mockResolvedValue(undefined);
    findAllBindingsMock.mockResolvedValue([]);

    const { aiSettingsService } = await import("@/server/services/ai-settings.service");
    await aiSettingsService.updateSettings(adminUser, {
      bindings: [{ step: "TRANSCRIBE", modelConfigId: "config_1" }],
    });

    expect(replaceAllMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        { step: "TRANSCRIBE", modelConfigId: "config_1" },
        { step: "DECOMPOSE", modelConfigId: null },
        { step: "REWRITE", modelConfigId: null },
      ]),
    );
  });
});
