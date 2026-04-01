import type { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    id: string;
    account: string;
    role: UserRole;
    organizationId: string;
  }

  interface Session {
    user?: DefaultSession["user"] & {
      id: string;
      account: string;
      role: UserRole;
      organizationId: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    account: string;
    role: UserRole;
    organizationId: string;
  }
}
