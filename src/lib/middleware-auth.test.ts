import { describe, expect, it } from "vitest";

import { getAuthRedirectPath, isDashboardRoute } from "@/lib/middleware-auth";

describe("middleware auth routing", () => {
  it("identifies dashboard routes", () => {
    expect(isDashboardRoute("/dashboard")).toBe(true);
    expect(isDashboardRoute("/dashboard/users")).toBe(true);
    expect(isDashboardRoute("/login")).toBe(false);
  });

  it("identifies organizations and users routes as protected", () => {
    expect(isDashboardRoute("/organizations")).toBe(true);
    expect(isDashboardRoute("/organizations/123")).toBe(true);
    expect(isDashboardRoute("/users")).toBe(true);
    expect(isDashboardRoute("/users/abc")).toBe(true);
  });

  it("redirects authenticated users away from login", () => {
    expect(getAuthRedirectPath("/login", true)).toBe("/dashboard");
  });

  it("redirects unauthenticated users to login for dashboard routes", () => {
    expect(getAuthRedirectPath("/dashboard", false)).toBe("/login");
    expect(getAuthRedirectPath("/dashboard/users", false)).toBe("/login");
    expect(getAuthRedirectPath("/organizations", false)).toBe("/login");
    expect(getAuthRedirectPath("/users", false)).toBe("/login");
  });

  it("does not redirect safe routes", () => {
    expect(getAuthRedirectPath("/login", false)).toBeNull();
    expect(getAuthRedirectPath("/dashboard", true)).toBeNull();
  });
});
