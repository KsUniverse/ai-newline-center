import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createManyPreciselyMock,
  findByIdMock,
  findManyMock,
  softDeleteMock,
} = vi.hoisted(() => ({
  createManyPreciselyMock: vi.fn(),
  findByIdMock: vi.fn(),
  findManyMock: vi.fn(),
  softDeleteMock: vi.fn(),
}));

vi.mock("@/server/repositories/fragment.repository", () => ({
  fragmentRepository: {
    createManyPrecisely: createManyPreciselyMock,
    findById: findByIdMock,
    findMany: findManyMock,
    softDelete: softDeleteMock,
  },
}));

import { AppError } from "@/lib/errors";
import { fragmentService } from "@/server/services/fragment.service";

describe("fragmentService", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    createManyPreciselyMock.mockReset();
    findByIdMock.mockReset();
    findManyMock.mockReset();
    softDeleteMock.mockReset();
  });

  it("trims and filters blank lines before creating fragments", async () => {
    createManyPreciselyMock.mockResolvedValue([
      {
        id: "fragment_1",
        content: "第一条观点",
        organizationId: "org_1",
        createdByUserId: "user_1",
        createdAt: new Date("2026-04-10T10:00:00.000Z"),
        createdByUser: { id: "user_1", name: "员工A" },
      },
    ]);

    const result = await fragmentService.createFragments(
      {
        id: "user_1",
        account: "employee",
        name: "员工A",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
      {
        contents: ["  第一条观点  ", "", "   "],
      },
    );

    expect(createManyPreciselyMock).toHaveBeenCalledWith([
      {
        content: "第一条观点",
        organizationId: "org_1",
        createdByUserId: "user_1",
      },
    ]);
    expect(result).toEqual({
      created: 1,
      items: [
        {
          id: "fragment_1",
          content: "第一条观点",
          organizationId: "org_1",
          createdByUserId: "user_1",
          createdByUser: { id: "user_1", name: "员工A" },
          createdAt: "2026-04-10T10:00:00.000Z",
        },
      ],
    });
  });

  it("allows duplicate content fragments to be created in one request", async () => {
    createManyPreciselyMock.mockResolvedValue([
      {
        id: "fragment_1",
        content: "重复观点",
        organizationId: "org_1",
        createdByUserId: "user_1",
        createdAt: new Date("2026-04-10T10:00:00.000Z"),
        createdByUser: { id: "user_1", name: "员工A" },
      },
      {
        id: "fragment_2",
        content: "重复观点",
        organizationId: "org_1",
        createdByUserId: "user_1",
        createdAt: new Date("2026-04-10T10:01:00.000Z"),
        createdByUser: { id: "user_1", name: "员工A" },
      },
    ]);

    const result = await fragmentService.createFragments(
      {
        id: "user_1",
        account: "employee",
        name: "员工A",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
      {
        contents: ["重复观点", "重复观点"],
      },
    );

    expect(createManyPreciselyMock).toHaveBeenCalledWith([
      {
        content: "重复观点",
        organizationId: "org_1",
        createdByUserId: "user_1",
      },
      {
        content: "重复观点",
        organizationId: "org_1",
        createdByUserId: "user_1",
      },
    ]);
    expect(result.created).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ id: "fragment_1", content: "重复观点" });
    expect(result.items[1]).toMatchObject({ id: "fragment_2", content: "重复观点" });
  });

  it("rejects valid lines longer than 500 characters with VALIDATION_ERROR 400", async () => {
    await expect(
      fragmentService.createFragments(
        {
          id: "user_1",
          account: "employee",
          name: "员工A",
          role: UserRole.EMPLOYEE,
          organizationId: "org_1",
        },
        {
          contents: ["a".repeat(501)],
        },
      ),
    ).rejects.toEqual(new AppError("VALIDATION_ERROR", "观点内容不能超过 500 个字符", 400));
  });

  it("allows branch managers to delete any fragment inside their organization", async () => {
    findByIdMock.mockResolvedValue({
      id: "fragment_1",
      content: "观点",
      organizationId: "org_1",
      createdByUserId: "user_2",
      createdAt: new Date("2026-04-10T10:00:00.000Z"),
      createdByUser: { id: "user_2", name: "员工B" },
    });
    softDeleteMock.mockResolvedValue(true);

    const result = await fragmentService.deleteFragment(
      {
        id: "manager_1",
        account: "manager",
        name: "负责人",
        role: UserRole.BRANCH_MANAGER,
      organizationId: "org_1",
      },
      "fragment_1",
    );

    expect(findByIdMock).toHaveBeenCalledWith("fragment_1", "org_1");
    expect(softDeleteMock).toHaveBeenCalledWith({
      id: "fragment_1",
      organizationId: "org_1",
    });
    expect(result).toEqual({ id: "fragment_1" });
  });

  it("allows employees to delete their own fragments", async () => {
    findByIdMock.mockResolvedValue({
      id: "fragment_1",
      content: "观点",
      organizationId: "org_1",
      createdByUserId: "employee_1",
      createdAt: new Date("2026-04-10T10:00:00.000Z"),
      createdByUser: { id: "employee_1", name: "员工A" },
    });
    softDeleteMock.mockResolvedValue(true);

    const result = await fragmentService.deleteFragment(
      {
        id: "employee_1",
        account: "employee",
        name: "员工A",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
      "fragment_1",
    );

    expect(softDeleteMock).toHaveBeenCalledWith({
      id: "fragment_1",
      organizationId: "org_1",
    });
    expect(result).toEqual({ id: "fragment_1" });
  });

  it("allows SUPER_ADMIN to delete fragments inside their organization", async () => {
    findByIdMock.mockResolvedValue({
      id: "fragment_1",
      content: "观点",
      organizationId: "org_1",
      createdByUserId: "user_2",
      createdAt: new Date("2026-04-10T10:00:00.000Z"),
      createdByUser: { id: "user_2", name: "员工B" },
    });
    softDeleteMock.mockResolvedValue(true);

    const result = await fragmentService.deleteFragment(
      {
        id: "admin_1",
        account: "admin",
        name: "超级管理员",
        role: UserRole.SUPER_ADMIN,
      organizationId: "org_1",
      },
      "fragment_1",
    );

    expect(findByIdMock).toHaveBeenCalledWith("fragment_1", "org_1");
    expect(softDeleteMock).toHaveBeenCalledWith({
      id: "fragment_1",
      organizationId: "org_1",
    });
    expect(result).toEqual({ id: "fragment_1" });
  });

  it("throws NOT_FOUND when the fragment is missing or already deleted", async () => {
    findByIdMock.mockResolvedValueOnce(null);

    await expect(
      fragmentService.deleteFragment(
        {
          id: "admin_1",
          account: "admin",
          name: "超级管理员",
          role: UserRole.SUPER_ADMIN,
          organizationId: "org_1",
        },
        "missing_fragment",
      ),
    ).rejects.toEqual(new AppError("NOT_FOUND", "观点不存在", 404));

    expect(findByIdMock).toHaveBeenNthCalledWith(1, "missing_fragment", "org_1");

    findByIdMock.mockResolvedValueOnce(null);

    await expect(
      fragmentService.deleteFragment(
        {
          id: "admin_1",
          account: "admin",
          name: "超级管理员",
          role: UserRole.SUPER_ADMIN,
          organizationId: "org_1",
        },
        "deleted_fragment",
      ),
    ).rejects.toEqual(new AppError("NOT_FOUND", "观点不存在", 404));

    expect(findByIdMock).toHaveBeenNthCalledWith(2, "deleted_fragment", "org_1");
    expect(softDeleteMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when deleting a fragment from another organization", async () => {
    findByIdMock.mockResolvedValueOnce(null);

    await expect(
      fragmentService.deleteFragment(
        {
          id: "manager_1",
          account: "manager",
          name: "负责人",
          role: UserRole.BRANCH_MANAGER,
          organizationId: "org_2",
        },
        "fragment_1",
      ),
    ).rejects.toEqual(new AppError("NOT_FOUND", "观点不存在", 404));

    expect(findByIdMock).toHaveBeenCalledWith("fragment_1", "org_2");
    expect(softDeleteMock).not.toHaveBeenCalled();
  });

  it("prevents employees from deleting other users' fragments", async () => {
    findByIdMock.mockResolvedValue({
      id: "fragment_1",
      content: "观点",
      organizationId: "org_1",
      createdByUserId: "user_2",
      createdAt: new Date("2026-04-10T10:00:00.000Z"),
      createdByUser: { id: "user_2", name: "员工B" },
    });

    await expect(
      fragmentService.deleteFragment(
        {
          id: "employee_1",
          account: "employee",
          name: "员工A",
          role: UserRole.EMPLOYEE,
          organizationId: "org_1",
        },
        "fragment_1",
      ),
    ).rejects.toEqual(new AppError("FORBIDDEN", "无操作权限", 403));

    expect(softDeleteMock).not.toHaveBeenCalled();
  });

  it("delegates organization-scoped cursor queries and maps DTOs in listFragments", async () => {
    findManyMock.mockResolvedValue({
      items: [
        {
          id: "fragment_1",
          content: "观点 1",
          organizationId: "org_1",
          createdByUserId: "user_1",
          createdAt: new Date("2026-04-10T10:00:00.000Z"),
          createdByUser: { id: "user_1", name: "员工A" },
        },
      ],
      nextCursor: "next-cursor-token",
      hasMore: true,
    });

    const result = await fragmentService.listFragments(
      {
        id: "manager_1",
        account: "manager",
        name: "负责人",
        role: UserRole.BRANCH_MANAGER,
        organizationId: "org_1",
      },
      {
        q: "观点",
        cursor: "cursor-token",
      },
    );

    expect(findManyMock).toHaveBeenCalledWith({
      organizationId: "org_1",
      q: "观点",
      cursor: "cursor-token",
      limit: 20,
      scope: "today",
    });
    expect(result).toEqual({
      items: [
        {
          id: "fragment_1",
          content: "观点 1",
          organizationId: "org_1",
          createdByUserId: "user_1",
          createdByUser: { id: "user_1", name: "员工A" },
          createdAt: "2026-04-10T10:00:00.000Z",
        },
      ],
      nextCursor: "next-cursor-token",
      hasMore: true,
    });
  });

  it("defaults listFragments scope to today when not provided", async () => {
    findManyMock.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    });

    await fragmentService.listFragments(
      {
        id: "manager_1",
        account: "manager",
        name: "负责人",
        role: UserRole.BRANCH_MANAGER,
        organizationId: "org_1",
      },
      {},
    );

    expect(findManyMock).toHaveBeenCalledWith({
      organizationId: "org_1",
      q: undefined,
      cursor: undefined,
      limit: 20,
      scope: "today",
    });
  });

  it("passes explicit history scope to the repository", async () => {
    findManyMock.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    });

    await fragmentService.listFragments(
      {
        id: "manager_1",
        account: "manager",
        name: "负责人",
        role: UserRole.BRANCH_MANAGER,
        organizationId: "org_1",
      },
      {
        scope: "history",
        limit: 10,
      },
    );

    expect(findManyMock).toHaveBeenCalledWith({
      organizationId: "org_1",
      q: undefined,
      cursor: undefined,
      limit: 10,
      scope: "history",
    });
  });

  it("rejects malformed cursors with VALIDATION_ERROR 400", async () => {
    findManyMock.mockRejectedValueOnce(new AppError("VALIDATION_ERROR", "无效的游标", 400));

    await expect(
      fragmentService.listFragments(
        {
          id: "manager_1",
          account: "manager",
          name: "负责人",
          role: UserRole.BRANCH_MANAGER,
          organizationId: "org_1",
        },
        {
          cursor: "not-a-valid-cursor",
        },
      ),
    ).rejects.toEqual(new AppError("VALIDATION_ERROR", "无效的游标", 400));
    expect(findManyMock).toHaveBeenCalledWith({
      organizationId: "org_1",
      q: undefined,
      cursor: "not-a-valid-cursor",
      limit: 20,
      scope: "today",
    });
  });

  it("returns NOT_FOUND when softDelete does not affect a row after lookup", async () => {
    findByIdMock.mockResolvedValue({
      id: "fragment_1",
      content: "观点",
      organizationId: "org_1",
      createdByUserId: "user_2",
      createdAt: new Date("2026-04-10T10:00:00.000Z"),
      createdByUser: { id: "user_2", name: "员工B" },
    });
    softDeleteMock.mockResolvedValue(false);

    await expect(
      fragmentService.deleteFragment(
        {
          id: "manager_1",
          account: "manager",
          name: "负责人",
          role: UserRole.BRANCH_MANAGER,
          organizationId: "org_1",
        },
        "fragment_1",
      ),
    ).rejects.toEqual(new AppError("NOT_FOUND", "观点不存在", 404));
  });
});
