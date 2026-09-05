/**
 * Cross-site request forgery guard for cookie-authenticated route handlers.
 *
 * Server actions get Next.js's own origin check; plain route handlers do not.
 * A browser sends `Origin` on every cross-site POST (and `Sec-Fetch-Site` on
 * modern browsers), so a state-changing request whose origin is not this
 * deployment is refused. Requests with neither header (curl, server-to-server)
 * pass: they carry no ambient cookie to abuse.
 */
export function isSameOriginRequest(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site" && fetchSite !== "none") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  if (originHost === requestHost) return true;

  const appHost = (() => {
    try {
      return process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).host : null;
    } catch {
      return null;
    }
  })();
  return appHost !== null && originHost === appHost;
}

/** Throws a Response-shaped error the route can return directly. */
export function rejectCrossOrigin(request: Request): Response | null {
  if (isSameOriginRequest(request)) return null;
  return new Response(JSON.stringify({ error: "Cross-site request refused." }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}
