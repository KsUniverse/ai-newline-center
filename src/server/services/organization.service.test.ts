import { OrganizationStatus, OrganizationType, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  countActiveUsersMock,
  createMock,
  findAllBranchesMock,
  findByIdMock,
  findByNameMock,
  findGroupOrgMock,
  updateMock,
  updateUsersStatusByOrganizationMock,
  transactionMock,
} = vi.hoisted(() => ({
  countActiveUsersMock: vi.fn(),
  createMock: vi.fn(),
  findAllBranchesMock: vi.fn(),
  findByIdMock: vi.fn(),
  findByNameMock: vi.fn(),
  findGroupOrgMock: vi.fn(),
  updateMock: vi.fn(),
  updateUsersStatusByOrganizationMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/server/repositories/organization.repository", () => ({
  organizationRepository: {
    countActiveUsers: countActiveUsersMock,
    create: createMock,
    findAllBranches: findAllBranchesMock,
    findById: findByIdMock,
    findByName: findByNameMock,
    findGroupOrg: findGroupOrgMock,
    update: updateMock,
    updateUsersStatusByOrganization: updateUsersStatusByOrganizationMock,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

import { AppError } from "@/lib/errors";
import { organizationService } from "@/server/services/organization.service";

describe("organizationService", () => {
  beforeEach(() => {
    countActiveUsersMock.mockReset();
    createMock.mockReset();
    findAllBranchesMock.mockReset();
    findByIdMock.mockReset();
    findByNameMock.mockReset();
    findGroupOrgMock.mockReset();
    updateMock.mockReset();
    updateUsersStatusByOrganizationMock.mockReset();
    transactionMock.mockReset();
  });

  it("creates a branch under the group organization", async () => {
    findByNameMock.mockResolvedValue(null);
    findGroupOrgMock.mockResolvedValue({
      id: "group_1",
      type: OrganizationType.GROUP,
    });
    createMock.mockResolvedValue({
      id: "branch_1",
      name: "上海分公司",
      type: OrganizationType.BRANCH,
      parentId: "group_1",
      status: OrganizationStatus.ACTIVE,
    });

    const result = await organizationService.createBranch("上海分公司");

    expect(createMock).toHaveBeenCalledWith(
      {
        name: "上海分公司",
        parentId: "group_1",
      },
    );
    expect(result).toMatchObject({
      id: "branch_1",
      name: "上海分公司",
      status: OrganizationStatus.ACTIVE,
    });
  });

  it("disables a branch and cascades user disabling in one transaction", async () => {
    const tx = { kind: "tx" };

    transactionMock.mockImplementation(async (callback: (client: unknown) => Promise<unknown>) =>
      callback(tx),
    );
    findByIdMock.mockResolvedValue({
      id: "branch_1",
      type: OrganizationType.BRANCH,
      status: OrganizationStatus.ACTIVE,
    });
    countActiveUsersMock.mockResolvedValue(2);
    updateUsersStatusByOrganizationMock.mockResolvedValue({ count: 2 });
    updateMock.mockResolvedValue({
      id: "branch_1",
      status: OrganizationStatus.DISABLED,
    });

    const result = await organizationService.setStatus("branch_1", OrganizationStatus.DISABLED);

    expect(countActiveUsersMock).toHaveBeenCalledWith("branch_1", UserStatus.ACTIVE, tx);
    expect(updateUsersStatusByOrganizationMock).toHaveBeenCalledWith(
      "branch_1",
      UserStatus.ACTIVE,
      UserStatus.DISABLED,
      tx,
    );
    expect(updateMock).toHaveBeenCalledWith(
      "branch_1",
      { status: OrganizationStatus.DISABLED },
      tx,
    );
    expect(result).toEqual({
      affectedUserCount: 2,
      org: {
        id: "branch_1",
        status: OrganizationStatus.DISABLED,
      },
    });
  });

  it("throws FORBIDDEN when trying to change the group organization", async () => {
    findByIdMock.mockResolvedValue({
      id: "group_1",
      type: OrganizationType.GROUP,
      status: OrganizationStatus.ACTIVE,
    });

    await expect(
      organizationService.setStatus("group_1", OrganizationStatus.DISABLED),
    ).rejects.toEqual(new AppError("FORBIDDEN", "集团组织不允许操作", 403));
  });
});
