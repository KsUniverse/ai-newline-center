import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { userRepository } from "@/server/repositories/user.repository";

export interface SessionUser {
  id: string;
  name: string;
  account: string;
  role: UserRole;
  organizationId: string;
}

// 用于恒定时间比对的虚拟哈希，防止基于响应时间的账号枚举攻击
const DUMMY_HASH = "$2b$12$invalidhashfortimingnormalizationxxxxxxxxxxxxxxx";

class UserService {
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
}

export const userService = new UserService();
