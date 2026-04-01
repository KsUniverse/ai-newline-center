import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { userRepository } from "@/server/repositories/user.repository";
import type { PaginatedData } from "@/types/api";

export interface SessionUser {
  id: string;
  name?: string | null;
  account: string;
  role: UserRole;
  organizationId: string;
}

// 用于恒定时间比对的虚拟哈希，防止基于响应时间的账号枚举攻击
const DUMMY_HASH = "$2b$12$invalidhashfortimingnormalizationxxxxxxxxxxxxxxx";

interface ListUsersParams {
  organizationId?: string;
  page: number;
  limit: number;
}

interface CreateUserData {
  account: string;
  password: string;
  name: string;
  role: UserRole;
  organizationId: string;
}

interface UpdateUserData {
  name?: string;
  role?: UserRole;
}

type UserWithOrganization = NonNullable<Awaited<ReturnType<typeof userRepository.findById>>>;
type SafeUser = Omit<UserWithOrganization, "passwordHash">;

class UserService {
  private sanitizeUser(user: UserWithOrganization): SafeUser {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    void _passwordHash;
    return safeUser;
  }

  async verifyCredentials(account: string, password: string): Promise<SessionUser> {
    const user = await userRepository.findByAccount(account);

    // 无论账号是否存在，都执行 bcrypt 比对，保证响应时间恒定
    const hash = user?.status === UserStatus.ACTIVE ? user.passwordHash : DUMMY_HASH;
    const passwordMatched = await bcrypt.compare(password, hash);

    if (!user || user.status === UserStatus.DISABLED || !passwordMatched) {
      throw new AppError("INVALID_CREDENTIALS", "账号或密码错误", 401);
    }

    return {
      id: user.id,
      name: user.name,
      account: user.account,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  async listUsers(
    caller: SessionUser,
    params: ListUsersParams,
  ): Promise<PaginatedData<SafeUser>> {
    const organizationId =
      caller.role === UserRole.SUPER_ADMIN ? params.organizationId : caller.organizationId;

    const result = await userRepository.list({
      organizationId,
      page: params.page,
      limit: params.limit,
    });

    return {
      ...result,
      items: result.items.map((item) => this.sanitizeUser(item)),
    };
  }

  async getUserById(caller: SessionUser, id: string): Promise<SafeUser> {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new AppError("NOT_FOUND", "用户不存在", 404);
    }

    if (caller.role !== UserRole.SUPER_ADMIN && caller.organizationId !== user.organizationId) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    return this.sanitizeUser(user);
  }

  async createUser(caller: SessionUser, data: CreateUserData) {
    if (caller.role === UserRole.BRANCH_MANAGER) {
      if (data.role !== UserRole.EMPLOYEE || data.organizationId !== caller.organizationId) {
        throw new AppError("FORBIDDEN", "无操作权限", 403);
      }
    }

    const existing = await userRepository.findByAccount(data.account);
    if (existing) {
      throw new AppError("CONFLICT", "账号已存在", 409);
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const createdUser = await userRepository.create({
      account: data.account,
      passwordHash,
      name: data.name,
      role: data.role,
      organizationId: data.organizationId,
    });

    const userWithOrganization = await userRepository.findById(createdUser.id);
    if (!userWithOrganization) {
      throw new AppError("NOT_FOUND", "用户不存在", 404);
    }

    return this.sanitizeUser(userWithOrganization);
  }

  async updateUser(caller: SessionUser, id: string, data: UpdateUserData) {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new AppError("NOT_FOUND", "用户不存在", 404);
    }

    if (caller.role !== UserRole.SUPER_ADMIN && caller.organizationId !== user.organizationId) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    if (caller.role === UserRole.BRANCH_MANAGER && data.role && data.role !== UserRole.EMPLOYEE) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    await userRepository.update(user.id, data);

    const updatedUser = await userRepository.findById(user.id);
    if (!updatedUser) {
      throw new AppError("NOT_FOUND", "用户不存在", 404);
    }

    return this.sanitizeUser(updatedUser);
  }

  async setUserStatus(caller: SessionUser, id: string, status: UserStatus) {
    if (caller.id === id && status === UserStatus.DISABLED) {
      throw new AppError("FORBIDDEN", "不能禁用当前登录账号", 403);
    }

    const user = await userRepository.findById(id);

    if (!user) {
      throw new AppError("NOT_FOUND", "用户不存在", 404);
    }

    if (caller.role !== UserRole.SUPER_ADMIN && caller.organizationId !== user.organizationId) {
      throw new AppError("FORBIDDEN", "无操作权限", 403);
    }

    await userRepository.setStatus(user.id, status);

    const updatedUser = await userRepository.findById(user.id);
    if (!updatedUser) {
      throw new AppError("NOT_FOUND", "用户不存在", 404);
    }

    return this.sanitizeUser(updatedUser);
  }
}

export const userService = new UserService();
