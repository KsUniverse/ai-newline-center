export function isDashboardRoute(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
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
