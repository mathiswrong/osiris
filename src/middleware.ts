import { NextResponse } from "next/server";
// This public fork does not transmit visitors' IP addresses to upstream analytics.
export function middleware() {
  return NextResponse.next();
}
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|vendor|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs|js|css|json|pbf|mvt|woff|woff2|ico|txt)$).*)',
  ],
}
