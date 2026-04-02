import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { requireRole, requireSameOrg } from "@/lib/auth-guard";

describe("auth-guard", () => {
  it("requireRole throws UNAUTHORIZED when session is missing", () => {
    expect(() => requireRole(null, UserRole.SUPER_ADMIN)).toThrowError("请先登录");
  });

  it("requireRole throws FORBIDDEN when role is not allowed", () => {
    const session = {
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "user_1",
        account: "manager",
        role: UserRole.BRANCH_MANAGER,
        organizationId: "org_1",
      },
    };

    expect(() => requireRole(session, UserRole.SUPER_ADMIN)).toThrowError("无操作权限");
  });

  it("requireSameOrg allows super admin to access any organization", () => {
    const session = {
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "user_1",
        account: "admin",
        role: UserRole.SUPER_ADMIN,
        organizationId: "org_1",
      },
    };

    expect(() => requireSameOrg(session, "org_2")).not.toThrow();
  });

  it("requireSameOrg throws FORBIDDEN when branch manager crosses organizations", () => {
    const session = {
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "user_1",
        account: "manager",
        role: UserRole.BRANCH_MANAGER,
        organizationId: "org_1",
      },
    };

    expect(() => requireSameOrg(session, "org_2")).toThrowError("无操作权限");
  });
});
