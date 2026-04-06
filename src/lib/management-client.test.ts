import { beforeEach, describe, expect, it, vi } from "vitest";

const { delMock, getMock, patchMock, postMock, putMock } = vi.hoisted(() => ({
  delMock: vi.fn(),
  getMock: vi.fn(),
  patchMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: getMock,
    post: postMock,
    put: putMock,
    patch: patchMock,
    del: delMock,
  },
}));

import { managementClient } from "@/lib/management-client";

describe("managementClient", () => {
  beforeEach(() => {
    delMock.mockReset();
    getMock.mockReset();
    patchMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
  });

  it("loads organizations from the organizations endpoint", async () => {
    getMock.mockResolvedValue([{ id: "org_1", name: "杭州分公司" }]);

    const result = await managementClient.listOrganizations();

    expect(getMock).toHaveBeenCalledWith("/organizations");
    expect(result).toEqual([{ id: "org_1", name: "杭州分公司" }]);
  });

  it("creates an organization with the expected payload", async () => {
    postMock.mockResolvedValue({ id: "org_1", name: "杭州分公司" });

    await managementClient.createOrganization({ name: "杭州分公司" });

    expect(postMock).toHaveBeenCalledWith("/organizations", {
      name: "杭州分公司",
    });
  });

  it("updates an organization through the detail endpoint", async () => {
    putMock.mockResolvedValue({ id: "org_1", name: "宁波分公司" });

    await managementClient.updateOrganization("org_1", {
      name: "宁波分公司",
    });

    expect(putMock).toHaveBeenCalledWith("/organizations/org_1", {
      name: "宁波分公司",
    });
  });

  it("toggles organization status through the status endpoint", async () => {
    patchMock.mockResolvedValue({
      org: { id: "org_1", status: "DISABLED" },
      affectedUserCount: 3,
    });

    const result = await managementClient.setOrganizationStatus("org_1", {
      status: "DISABLED",
    });

    expect(patchMock).toHaveBeenCalledWith("/organizations/org_1/status", {
      status: "DISABLED",
    });
    expect(result.affectedUserCount).toBe(3);
  });

  it("loads users with encoded query parameters", async () => {
    getMock.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

    await managementClient.listUsers({
      page: 1,
      limit: 20,
      organizationId: "org_1",
    });

    expect(getMock).toHaveBeenCalledWith("/users?page=1&limit=20&organizationId=org_1");
  });

  it("creates a user with the expected payload", async () => {
    postMock.mockResolvedValue({ id: "user_1", name: "张三" });

    await managementClient.createUser({
      account: "zhangsan",
      password: "secret123",
      name: "张三",
      role: "EMPLOYEE",
      organizationId: "org_1",
    });

    expect(postMock).toHaveBeenCalledWith("/users", {
      account: "zhangsan",
      password: "secret123",
      name: "张三",
      role: "EMPLOYEE",
      organizationId: "org_1",
    });
  });

  it("updates a user through the detail endpoint", async () => {
    putMock.mockResolvedValue({ id: "user_1", name: "李四" });

    await managementClient.updateUser("user_1", {
      name: "李四",
      role: "BRANCH_MANAGER",
    });

    expect(putMock).toHaveBeenCalledWith("/users/user_1", {
      name: "李四",
      role: "BRANCH_MANAGER",
    });
  });

  it("toggles user status through the status endpoint", async () => {
    patchMock.mockResolvedValue({ id: "user_1", status: "DISABLED" });

    await managementClient.setUserStatus("user_1", { status: "DISABLED" });

    expect(patchMock).toHaveBeenCalledWith("/users/user_1/status", {
      status: "DISABLED",
    });
  });

  it("loads AI configuration bindings from the management endpoint", async () => {
    getMock.mockResolvedValue({
      steps: [
        {
          step: "TRANSCRIBE",
          implementationKey: "volcengine-transcribe",
          name: "火山引擎转录",
          provider: "Volcengine Ark",
          available: true,
          requiredEnvKeys: ["TRANSCRIBE_API_KEY"],
        },
      ],
    });

    const result = await managementClient.getAiConfig();

    expect(getMock).toHaveBeenCalledWith("/system-settings/ai");
    expect(result.steps[0]?.step).toBe("TRANSCRIBE");
  });

  it("saves AI configuration bindings through the management endpoint", async () => {
    putMock.mockResolvedValue({
      steps: [
        {
          step: "REWRITE",
          implementationKey: "ark-rewrite",
          name: "Ark 仿写",
          provider: "Ark",
          available: true,
          requiredEnvKeys: ["ARK_API_KEY", "ARK_BASE_URL", "ARK_REWRITE_MODEL"],
        },
      ],
    });

    await managementClient.updateAiConfig({
      bindings: [
        {
          step: "REWRITE",
          implementationKey: "ark-rewrite",
        },
      ],
    });

    expect(putMock).toHaveBeenCalledWith("/system-settings/ai", {
      bindings: [
        {
          step: "REWRITE",
          implementationKey: "ark-rewrite",
        },
      ],
    });
  });
});
