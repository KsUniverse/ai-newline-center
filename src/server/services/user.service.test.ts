import { beforeEach, describe, expect, it, vi } from "vitest";

const { compareMock, findByAccountMock } = vi.hoisted(() => ({
  compareMock: vi.fn(),
  findByAccountMock: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: compareMock,
  },
  compare: compareMock,
}));

vi.mock("@/server/repositories/user.repository", () => ({
  userRepository: {
    findByAccount: findByAccountMock,
  },
}));

import { AppError } from "@/lib/errors";
import { userService } from "@/server/services/user.service";

describe("userService.verifyCredentials", () => {
  beforeEach(() => {
    compareMock.mockReset();
    findByAccountMock.mockReset();
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
});
