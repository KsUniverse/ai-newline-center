import { UserRole } from "@prisma/client";
import type { Session } from "next-auth";

import { AppError } from "@/lib/errors";

type AuthenticatedSession = Session & {
  user: NonNullable<Session["user"]>;
};

export function requireRole(
  session: Session | null,
  ...roles: UserRole[]
): asserts session is AuthenticatedSession {
  if (!session?.user) {
    throw new AppError("UNAUTHORIZED", "请先登录", 401);
  }

  if (!roles.includes(session.user.role)) {
    throw new AppError("FORBIDDEN", "无操作权限", 403);
  }
}

export function requireSameOrg(
  session: AuthenticatedSession,
  targetOrgId: string,
): void {
  if (!session.user) {
    throw new AppError("UNAUTHORIZED", "请先登录", 401);
  }

  if (session.user.role === UserRole.SUPER_ADMIN) {
    return;
  }

  if (session.user.organizationId !== targetOrgId) {
    throw new AppError("FORBIDDEN", "无操作权限", 403);
  }
}
