import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate: bounce signed-out visitors away from app routes before
 * rendering. Real authorization happens in every page and route handler.
 */
const APP = ["/home", "/practice", "/playback", "/drills", "/ladder", "/progress", "/profile", "/room", "/admin", "/onboarding"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (APP.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !req.cookies.get("oriel_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next|favicon|mediapipe|.*\\..*).*)"] };
