import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findAllMock,
  listImplementationsMock,
  replaceAllMock,
} = vi.hoisted(() => ({
  findAllMock: vi.fn(),
  listImplementationsMock: vi.fn(),
  replaceAllMock: vi.fn(),
}));

vi.mock("@/server/repositories/ai-step-binding.repository", () => ({
  aiStepBindingRepository: {
    findAll: findAllMock,
    replaceAll: replaceAllMock,
  },
}));

vi.mock("@/server/services/ai-gateway.service", () => ({
  aiGateway: {
    listImplementations: listImplementationsMock,
  },
}));

describe("aiSettingsService", () => {
  beforeEach(() => {
    findAllMock.mockReset();
    listImplementationsMock.mockReset();
    replaceAllMock.mockReset();

    listImplementationsMock.mockReturnValue([
      {
        key: "volcengine-transcribe",
        name: "火山引擎转录",
        provider: "Volcengine Ark",
        supportedSteps: ["TRANSCRIBE"],
        available: true,
        requiredEnvKeys: [],
      },
      {
        key: "ark-decompose",
        name: "Ark 拆解",
        provider: "Ark",
        supportedSteps: ["DECOMPOSE"],
        available: true,
        requiredEnvKeys: [],
      },
      {
        key: "ark-rewrite",
        name: "Ark 仿写",
        provider: "Ark",
        supportedSteps: ["REWRITE"],
        available: true,
        requiredEnvKeys: [],
      },
    ]);
  });

  it("returns implementation registry and current bindings for super admin", async () => {
    findAllMock.mockResolvedValue([
      { step: "TRANSCRIBE", implementationKey: "volcengine-transcribe" },
      { step: "DECOMPOSE", implementationKey: null },
      { step: "REWRITE", implementationKey: "ark-rewrite" },
    ]);

    const { aiSettingsService } = await import("@/server/services/ai-settings.service");
    const result = await aiSettingsService.getSettings({
      id: "user_1",
      account: "admin",
      role: UserRole.SUPER_ADMIN,
      organizationId: "org_1",
    });

    expect(result.bindings).toHaveLength(3);
    expect(result.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ step: "TRANSCRIBE" }),
        expect.objectContaining({ step: "DECOMPOSE" }),
        expect.objectContaining({ step: "REWRITE" }),
      ]),
    );
  });

  it("persists updated bindings", async () => {
    replaceAllMock.mockResolvedValue(undefined);
    findAllMock.mockResolvedValue([
      { step: "TRANSCRIBE", implementationKey: "volcengine-transcribe" },
      { step: "DECOMPOSE", implementationKey: "ark-decompose" },
      { step: "REWRITE", implementationKey: "ark-rewrite" },
    ]);

    const { aiSettingsService } = await import("@/server/services/ai-settings.service");
    await aiSettingsService.updateSettings(
      {
        id: "user_1",
        account: "admin",
        role: UserRole.SUPER_ADMIN,
        organizationId: "org_1",
      },
      {
        steps: [
          { step: "TRANSCRIBE", implementationKey: "volcengine-transcribe" },
          { step: "DECOMPOSE", implementationKey: "ark-decompose" },
          { step: "REWRITE", implementationKey: "ark-rewrite" },
        ],
      },
    );

    expect(replaceAllMock).toHaveBeenCalledWith([
      { step: "TRANSCRIBE", implementationKey: "volcengine-transcribe" },
      { step: "DECOMPOSE", implementationKey: "ark-decompose" },
      { step: "REWRITE", implementationKey: "ark-rewrite" },
    ]);
  });

  it("fills unspecified steps with null when replacing bindings", async () => {
    replaceAllMock.mockResolvedValue(undefined);
    findAllMock.mockResolvedValue([]);

    const { aiSettingsService } = await import("@/server/services/ai-settings.service");
    await aiSettingsService.updateSettings(
      {
        id: "user_1",
        account: "admin",
        role: UserRole.SUPER_ADMIN,
        organizationId: "org_1",
      },
      {
        steps: [{ step: "TRANSCRIBE", implementationKey: "volcengine-transcribe" }],
      },
    );

    expect(replaceAllMock).toHaveBeenCalledWith([
      { step: "TRANSCRIBE", implementationKey: "volcengine-transcribe" },
      { step: "DECOMPOSE", implementationKey: null },
      { step: "REWRITE", implementationKey: null },
    ]);
  });
});
