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

  it("identifies settings routes as protected", () => {
    expect(isDashboardRoute("/settings")).toBe(true);
    expect(isDashboardRoute("/settings/crawler-cookies")).toBe(true);
  });

  it("does not redirect login when only a token is present", () => {
    expect(getAuthRedirectPath("/login", true)).toBeNull();
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
