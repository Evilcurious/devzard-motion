import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionWeb } from "@/lib/auth-edge";

/** Edge-runtime gate. Node-runtime routes re-check with `guard()` / `currentUser()`. */
export async function middleware(request: NextRequest) {
  const ok = await verifySessionWeb(request.cookies.get(SESSION_COOKIE)?.value);
  if (!ok) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
