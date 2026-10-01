import { NextResponse, type NextRequest } from "next/server";

/**
 * When ROOT_DOMAIN is set (e.g. "farho.com"), requests to "<slug>.farho.com"
 * are served from the store's storefront at /store/<slug>.
 */
export function middleware(req: NextRequest) {
  const root = process.env.ROOT_DOMAIN;
  if (!root) return NextResponse.next();
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (host === root || host === `www.${root}` || !host.endsWith(`.${root}`)) return NextResponse.next();

  const slug = host.slice(0, -(root.length + 1));
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/store/") || pathname.startsWith("/uploads/")) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/store/${slug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
