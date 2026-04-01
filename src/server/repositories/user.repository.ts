import type { Prisma, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type UserWithOrganization = Prisma.UserGetPayload<{
  include: { organization: true };
}>;

class UserRepository {
  async findByAccount(account: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        account,
        deletedAt: null,
      },
    });
  }

  async findById(id: string): Promise<UserWithOrganization | null> {
    return prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        organization: true,
      },
    });
  }
}

export const userRepository = new UserRepository();
