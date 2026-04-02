export function isDashboardRoute(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/organizations" ||
    pathname.startsWith("/organizations/") ||
    pathname === "/users" ||
    pathname.startsWith("/users/")
  );
}

export function getAuthRedirectPath(
  pathname: string,
  isAuthenticated: boolean,
): string | null {
  if (pathname === "/login" && isAuthenticated) {
    return "/dashboard";
  }

  if (isDashboardRoute(pathname) && !isAuthenticated) {
    return "/login";
  }

  return null;
}
