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
        key: "ark-default",
        name: "Ark Default",
        provider: "Ark",
        supportedSteps: ["TRANSCRIBE", "DECOMPOSE", "REWRITE"],
        available: true,
        requiredEnvKeys: [],
      },
    ]);
  });

  it("returns implementation registry and current bindings for super admin", async () => {
    findAllMock.mockResolvedValue([
      { step: "TRANSCRIBE", implementationKey: "ark-default" },
      { step: "DECOMPOSE", implementationKey: null },
      { step: "REWRITE", implementationKey: "ark-default" },
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
      { step: "TRANSCRIBE", implementationKey: "ark-default" },
      { step: "DECOMPOSE", implementationKey: "ark-default" },
      { step: "REWRITE", implementationKey: "ark-default" },
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
          { step: "TRANSCRIBE", implementationKey: "ark-default" },
          { step: "DECOMPOSE", implementationKey: "ark-default" },
          { step: "REWRITE", implementationKey: "ark-default" },
        ],
      },
    );

    expect(replaceAllMock).toHaveBeenCalledWith([
      { step: "TRANSCRIBE", implementationKey: "ark-default" },
      { step: "DECOMPOSE", implementationKey: "ark-default" },
      { step: "REWRITE", implementationKey: "ark-default" },
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
        steps: [{ step: "TRANSCRIBE", implementationKey: "ark-default" }],
      },
    );

    expect(replaceAllMock).toHaveBeenCalledWith([
      { step: "TRANSCRIBE", implementationKey: "ark-default" },
      { step: "DECOMPOSE", implementationKey: null },
      { step: "REWRITE", implementationKey: null },
    ]);
  });
});
