import { NextResponse, type NextRequest } from "next/server";

// Cheap gate: no session cookie → login page. The cookie itself is verified
// on the server by getUser()/requireUser() in every page and API route.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("sop_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!login|api|_next/|icons/|sw\\.js|offline\\.html|manifest\\.webmanifest|favicon\\.ico).*)"],
};
