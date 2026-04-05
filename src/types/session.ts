import type { UserRole } from "@prisma/client";

export interface SessionUser {
  id: string;
  name?: string | null;
  account: string;
  role: UserRole;
  organizationId: string;
}