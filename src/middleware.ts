import { NextResponse, type NextRequest } from "next/server";

export const STOREFRONT_SESSION_COOKIE = "halyard_sid";

/**
 * Two jobs, both cheap:
 *
 * 1. Custom domains. A request whose host is not one of Halyard's own is a
 *    merchant's connected domain: it is rewritten to that store's storefront
 *    (`/s/<slug>/…`). The host→slug lookup goes through a small API route,
 *    because this runs at the edge with no database; answers are cached in
 *    memory per instance and at the CDN. An unknown host falls through to the
 *    normal site, so a misconfigured DNS record never breaks Halyard itself.
 *
 * 2. Storefront visitor session. Every storefront visitor carries a stable
 *    session id: A/B assignment and analytics sessionisation key off it, and
 *    doing it here lets the server resolve a visitor's variant during render.
 */
const hostCache = new Map<string, { slug: string | null; expires: number }>();
const HOST_CACHE_MS = 60_000;

function platformHosts(): string[] {
  const hosts = new Set<string>(["localhost", "127.0.0.1"]);
  try {
    if (process.env.NEXT_PUBLIC_APP_URL) hosts.add(new URL(process.env.NEXT_PUBLIC_APP_URL).hostname);
  } catch {
    /* ignore */
  }
  for (const extra of (process.env.HALYARD_PLATFORM_HOSTS ?? "").split(",")) {
    if (extra.trim()) hosts.add(extra.trim().toLowerCase());
  }
  if (process.env.VERCEL_URL) hosts.add(process.env.VERCEL_URL.toLowerCase());
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) hosts.add(process.env.VERCEL_PROJECT_PRODUCTION_URL.toLowerCase());
  return [...hosts];
}

function isPlatformHost(host: string): boolean {
  if (host.endsWith(".vercel.app")) return true;
  return platformHosts().some((p) => host === p || host.endsWith(`.${p}`));
}

async function slugForHost(request: NextRequest, host: string): Promise<string | null> {
  const cached = hostCache.get(host);
  if (cached && cached.expires > Date.now()) return cached.slug;
  let slug: string | null = null;
  try {
    const url = new URL(`/api/domains/resolve?host=${encodeURIComponent(host)}`, request.nextUrl.origin);
    const response = await fetch(url, { headers: { "x-halyard-internal": "1" } });
    if (response.ok) slug = ((await response.json()) as { slug: string | null }).slug;
  } catch {
    slug = null;
  }
  hostCache.set(host, { slug, expires: Date.now() + HOST_CACHE_MS });
  return slug;
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const path = request.nextUrl.pathname;

  let response: NextResponse | null = null;

  if (host && !isPlatformHost(host) && !path.startsWith("/api/") && !path.startsWith("/_next/")) {
    const slug = await slugForHost(request, host);
    if (slug) {
      const url = request.nextUrl.clone();
      // Paths already under this store's prefix pass through unchanged, so
      // absolute storefront links keep working on the custom domain.
      if (!path.startsWith(`/s/${slug}`)) url.pathname = `/s/${slug}${path === "/" ? "" : path}`;
      response = NextResponse.rewrite(url);
      response.headers.set("x-halyard-store", slug);
    }
  }

  response ??= NextResponse.next();

  if (path.startsWith("/s/") || response.headers.get("x-halyard-store")) {
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
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|og.png|robots.txt|sitemap.xml).*)"],
};
