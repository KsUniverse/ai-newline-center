export function isDashboardRoute(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/organizations" ||
    pathname.startsWith("/organizations/") ||
    pathname === "/users" ||
    pathname.startsWith("/users/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/")
  );
}

export function getAuthRedirectPath(
  pathname: string,
  isAuthenticated: boolean,
): string | null {
  if (isDashboardRoute(pathname) && !isAuthenticated) {
    return "/login";
  }

  return null;
}
