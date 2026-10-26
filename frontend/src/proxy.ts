import { NextResponse, type NextRequest } from "next/server";

// Fast, optimistic gate for workspace pages: no session cookie means straight to sign-in.
// The cookie itself is verified by the FastAPI backend on every API call.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("siq_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*"] };
