import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { getAuthRedirectPath } from "@/lib/middleware-auth";

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = await getToken({
    req: request,
    // NOTE: Edge Runtime 不支持 Node.js 模块，无法使用 env.ts，此处为已知例外
    secret: process.env.NEXTAUTH_SECRET,
  });
  const redirectPath = getAuthRedirectPath(pathname, Boolean(token));

  if (redirectPath) {
    return NextResponse.redirect(new URL(redirectPath, request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/organizations/:path*", "/users/:path*", "/accounts/:path*"],
};
