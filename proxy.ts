import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 Proxy — replaces the deprecated middleware convention.
 *
 * For auth we check the NextAuth session token cookie.
 * Detailed role-based authorization is handled in the client-side layout guards
 * (using useSession) since the proxy doesn't have access to the decoded session
 * payload without a DB call. The proxy's job is only:
 *   1. Redirect unauthenticated users away from protected routes
 *   2. Allow access to public routes and auth API
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — allow unauthenticated access
  if (pathname === "/" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Check for NextAuth session cookie (works for both secure and non-secure)
  const sessionToken =
    request.cookies.get("__Secure-authjs.session-token") ??
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-next-auth.session-token") ??
    request.cookies.get("next-auth.session-token");

  if (!sessionToken) {
    // Unauthenticated — redirect to login
    const loginUrl = new URL("/", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated — allow access. Role-based checks happen in the layout guards.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico and other static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
