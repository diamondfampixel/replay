import { NextResponse } from "next/server";
import { resolveStoreByHost } from "@/lib/services/domains";

export const runtime = "nodejs";

/**
 * Host → store slug, for the request router (middleware runs at the edge and
 * cannot open a database connection). Only CONNECTED domains resolve. The
 * answer is public information — the storefront itself is public — and is
 * cached briefly at the CDN so the lookup does not run on every request.
 */
export async function GET(request: Request) {
  const host = new URL(request.url).searchParams.get("host")?.toLowerCase().trim() ?? "";
  if (!host || host.length > 253 || !/^[a-z0-9.-]+$/.test(host)) {
    return NextResponse.json({ slug: null }, { status: 400 });
  }
  const store = await resolveStoreByHost(host);
  return NextResponse.json(
    { slug: store?.slug ?? null },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
