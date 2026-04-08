import bcrypt from "bcryptjs";
import { OrganizationType, PrismaClient, UserRole, UserStatus } from "@prisma/client";

import { env } from "../src/lib/env";

const DEFAULT_ORGANIZATION_ID = "seed_default_group";
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const { SEED_ADMIN_ACCOUNT, SEED_ADMIN_NAME, SEED_ADMIN_PASSWORD, SEED_ORG_NAME } = env;

  if (!SEED_ADMIN_ACCOUNT || !SEED_ADMIN_PASSWORD || !SEED_ADMIN_NAME || !SEED_ORG_NAME) {
    throw new Error("Seed 环境变量不完整，无法初始化超级管理员。");
  }

  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);

  const organization = await prisma.organization.upsert({
    where: {
      id: DEFAULT_ORGANIZATION_ID,
    },
    update: {
      name: SEED_ORG_NAME,
      type: OrganizationType.GROUP,
      deletedAt: null,
    },
    create: {
      id: DEFAULT_ORGANIZATION_ID,
      name: SEED_ORG_NAME,
      type: OrganizationType.GROUP,
    },
  });

  await prisma.user.upsert({
    where: {
      account: SEED_ADMIN_ACCOUNT,
    },
    update: {
      name: SEED_ADMIN_NAME,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      organizationId: organization.id,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      account: SEED_ADMIN_ACCOUNT,
      passwordHash,
      name: SEED_ADMIN_NAME,
      role: UserRole.SUPER_ADMIN,
      organizationId: organization.id,
      status: UserStatus.ACTIVE,
    },
  });
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
