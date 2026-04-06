import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, getSettingsMock, updateSettingsMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getSettingsMock: vi.fn(),
  updateSettingsMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/server/services/ai-settings.service", () => ({
  aiSettingsService: {
    getSettings: getSettingsMock,
    updateSettings: updateSettingsMock,
  },
}));

describe("/api/system-settings/ai", () => {
  beforeEach(() => {
    authMock.mockReset();
    getSettingsMock.mockReset();
    updateSettingsMock.mockReset();

    authMock.mockResolvedValue({
      user: {
        id: "user_1",
        account: "admin",
        role: UserRole.SUPER_ADMIN,
        organizationId: "org_1",
      },
    });
  });

  it("returns current settings for a super admin", async () => {
    getSettingsMock.mockResolvedValue({
      steps: [],
      bindings: [],
      implementations: [],
    });

    const { GET } = await import("@/app/api/system-settings/ai/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(getSettingsMock).toHaveBeenCalledWith(expect.objectContaining({ id: "user_1" }));
  });

  it("rejects empty binding payloads before reaching the service", async () => {
    const { PUT } = await import("@/app/api/system-settings/ai/route");
    const response = await PUT(
      new Request("http://localhost/api/system-settings/ai", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
      },
    });
    expect(updateSettingsMock).not.toHaveBeenCalled();
  });
});