import { NextResponse, type NextRequest } from "next/server";

export const STOREFRONT_SESSION_COOKIE = "halyard_sid";

/**
 * Ensures every storefront visitor carries a stable session id.
 *
 * Assignment to A/B variants and analytics sessionisation both key off this,
 * and doing it in middleware means the server can resolve a visitor's variant
 * during render — no flash of the control version.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (!request.cookies.get(STOREFRONT_SESSION_COOKIE)) {
    const id = `s_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
    response.cookies.set(STOREFRONT_SESSION_COOKIE, id, {
      httpOnly: false, // read by the client tracker as well
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  }
  return response;
}

export const config = {
  matcher: ["/s/:path*"],
};
