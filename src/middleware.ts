import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

function isDashboardRoute(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const isAuthenticated = Boolean(request.auth);

  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }

  if (isDashboardRoute(pathname) && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/login", "/dashboard/:path*"],
};
