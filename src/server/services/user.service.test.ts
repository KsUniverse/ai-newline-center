import { UserRole, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  compareMock,
  createMock,
  findByAccountMock,
  findByIdMock,
  hashMock,
  listMock,
  setStatusMock,
  updateMock,
} = vi.hoisted(() => ({
  compareMock: vi.fn(),
  createMock: vi.fn(),
  findByAccountMock: vi.fn(),
  findByIdMock: vi.fn(),
  hashMock: vi.fn(),
  listMock: vi.fn(),
  setStatusMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: compareMock,
    hash: hashMock,
  },
  compare: compareMock,
  hash: hashMock,
}));

vi.mock("@/server/repositories/user.repository", () => ({
  userRepository: {
    create: createMock,
    findByAccount: findByAccountMock,
    findById: findByIdMock,
    list: listMock,
    setStatus: setStatusMock,
    update: updateMock,
  },
}));

import { AppError } from "@/lib/errors";
import { userService } from "@/server/services/user.service";

describe("userService.verifyCredentials", () => {
  beforeEach(() => {
    compareMock.mockReset();
    createMock.mockReset();
    findByAccountMock.mockReset();
    findByIdMock.mockReset();
    hashMock.mockReset();
    listMock.mockReset();
    setStatusMock.mockReset();
    updateMock.mockReset();
  });

  it("returns a session user when account and password are correct", async () => {
    findByAccountMock.mockResolvedValue({
      id: "user_1",
      account: "admin",
      passwordHash: "hashed-password",
      name: "超级管理员",
      role: "SUPER_ADMIN",
      organizationId: "org_1",
      status: "ACTIVE",
    });
    compareMock.mockResolvedValue(true);

    const result = await userService.verifyCredentials("admin", "correct-password");

    expect(result).toEqual({
      id: "user_1",
      account: "admin",
      name: "超级管理员",
      role: "SUPER_ADMIN",
      organizationId: "org_1",
    });
  });

  it("throws the same error when the account does not exist", async () => {
    findByAccountMock.mockResolvedValue(null);

    await expect(userService.verifyCredentials("missing", "password")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "账号或密码错误",
      statusCode: 401,
    });
  });

  it("throws the same error when the user is disabled", async () => {
    findByAccountMock.mockResolvedValue({
      id: "user_1",
      account: "disabled",
      passwordHash: "hashed-password",
      name: "禁用用户",
      role: "EMPLOYEE",
      organizationId: "org_1",
      status: "DISABLED",
    });

    await expect(userService.verifyCredentials("disabled", "password")).rejects.toEqual(
      new AppError("INVALID_CREDENTIALS", "账号或密码错误", 401),
    );
  });

  it("throws the same error when the password is incorrect", async () => {
    findByAccountMock.mockResolvedValue({
      id: "user_1",
      account: "admin",
      passwordHash: "hashed-password",
      name: "超级管理员",
      role: "SUPER_ADMIN",
      organizationId: "org_1",
      status: "ACTIVE",
    });
    compareMock.mockResolvedValue(false);

    await expect(userService.verifyCredentials("admin", "wrong-password")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "账号或密码错误",
      statusCode: 401,
    });
  });

  it("forces branch manager list queries into their own organization", async () => {
    listMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    await userService.listUsers(
      {
        id: "manager_1",
        account: "manager",
        name: "负责人",
        role: UserRole.BRANCH_MANAGER,
        organizationId: "org_1",
      },
      {
        organizationId: "org_2",
        page: 1,
        limit: 20,
      },
    );

    expect(listMock).toHaveBeenCalledWith({
      organizationId: "org_1",
      page: 1,
      limit: 20,
    });
  });

  it("prevents branch manager from creating non-employee users", async () => {
    await expect(
      userService.createUser(
        {
          id: "manager_1",
          account: "manager",
          name: "负责人",
          role: UserRole.BRANCH_MANAGER,
          organizationId: "org_1",
        },
        {
          account: "branch_admin",
          password: "Admin123456",
          name: "分公司负责人",
          role: UserRole.BRANCH_MANAGER,
          organizationId: "org_1",
        },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  it("hashes the password before creating a user", async () => {
    findByAccountMock.mockResolvedValue(null);
    hashMock.mockResolvedValue("hashed-password");
    createMock.mockResolvedValue({
      id: "user_2",
      account: "employee_1",
      name: "员工",
      role: UserRole.EMPLOYEE,
      organizationId: "org_1",
      status: UserStatus.ACTIVE,
    });
    findByIdMock.mockResolvedValue({
      id: "user_2",
      account: "employee_1",
      passwordHash: "hashed-password",
      name: "员工",
      role: UserRole.EMPLOYEE,
      organizationId: "org_1",
      status: UserStatus.ACTIVE,
      organization: {
        id: "org_1",
        name: "上海分公司",
        type: "BRANCH",
        status: "ACTIVE",
      },
    });

    const result = await userService.createUser(
      {
        id: "admin_1",
        account: "admin",
        name: "管理员",
        role: UserRole.SUPER_ADMIN,
        organizationId: "group_1",
      },
      {
        account: "employee_1",
        password: "Admin123456",
        name: "员工",
        role: UserRole.EMPLOYEE,
        organizationId: "org_1",
      },
    );

    expect(hashMock).toHaveBeenCalledWith("Admin123456", 12);
    expect(createMock).toHaveBeenCalledWith({
      account: "employee_1",
      passwordHash: "hashed-password",
      name: "员工",
      role: UserRole.EMPLOYEE,
      organizationId: "org_1",
    });
    expect(result).toMatchObject({
      id: "user_2",
      account: "employee_1",
    });
  });

  it("prevents disabling the currently logged-in user", async () => {
    await expect(
      userService.setUserStatus(
        {
          id: "user_1",
          account: "admin",
          name: "管理员",
          role: UserRole.SUPER_ADMIN,
          organizationId: "group_1",
        },
        "user_1",
        UserStatus.DISABLED,
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });
});
