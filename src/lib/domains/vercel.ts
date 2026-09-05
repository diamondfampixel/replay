import "server-only";

/**
 * Thin client for the part of Vercel's REST API that attaches a merchant's
 * domain to Halyard's hosting project. Configured entirely by environment:
 *
 *   VERCEL_API_TOKEN   token with access to the project
 *   VERCEL_PROJECT_ID  the project (or name) that serves the storefronts
 *   VERCEL_TEAM_ID     optional, when the project belongs to a team
 *
 * Without these the domain feature runs in "reserve" mode: merchants can save
 * and validate a domain, DNS instructions are shown, but verification is
 * deferred until the hosting connection exists. Nothing pretends to verify.
 */
export type HostingDomainState = {
  /** Vercel accepted the domain on the project. */
  attached: boolean;
  /** Ownership verified (only false when the domain is claimed elsewhere on Vercel). */
  verified: boolean;
  /** DNS points at Vercel correctly. */
  configured: boolean;
  /** TXT records the registrar must add when ownership is contested. */
  verification: Array<{ type: string; domain: string; value: string }>;
  recommendedIPv4: string | null;
  recommendedCNAME: string | null;
  error: string | null;
};

export type HostingClient = {
  configured: boolean;
  add(domain: string): Promise<HostingDomainState>;
  status(domain: string): Promise<HostingDomainState>;
  verify(domain: string): Promise<HostingDomainState>;
  remove(domain: string): Promise<void>;
};

const API = "https://api.vercel.com";

function env() {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  const project = process.env.VERCEL_PROJECT_ID?.trim();
  const team = process.env.VERCEL_TEAM_ID?.trim();
  return { token, project, team };
}

export function isHostingConfigured(): boolean {
  const { token, project } = env();
  return Boolean(token && project);
}

type FetchLike = typeof fetch;

/** Real client, or a stub that reports the deferred state when unconfigured. Fetch is injectable for tests. */
export function hostingClient(fetchImpl: FetchLike = fetch): HostingClient {
  const { token, project, team } = env();
  if (!token || !project) {
    const deferred: HostingDomainState = {
      attached: false, verified: false, configured: false, verification: [],
      recommendedIPv4: null, recommendedCNAME: null, error: null,
    };
    return {
      configured: false,
      add: async () => deferred,
      status: async () => deferred,
      verify: async () => deferred,
      remove: async () => undefined,
    };
  }

  const query = team ? `?teamId=${encodeURIComponent(team)}` : "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function call(path: string, init: RequestInit = {}) {
    const response = await fetchImpl(`${API}${path}${query}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15_000) });
    const text = await response.text();
    let body: Record<string, unknown> = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    return { ok: response.ok, status: response.status, body };
  }

  async function config(domain: string) {
    const result = await call(`/v9/projects/${encodeURIComponent(project!)}/domains/${encodeURIComponent(domain)}/config`);
    const body = result.body as { misconfigured?: boolean; recommendedIPv4?: string[] | string; recommendedCNAME?: string[] | string };
    const first = (value: string[] | string | undefined) => (Array.isArray(value) ? value[0] ?? null : value ?? null);
    return {
      configured: result.ok && body.misconfigured === false,
      recommendedIPv4: first(body.recommendedIPv4),
      recommendedCNAME: first(body.recommendedCNAME),
    };
  }

  function stateFrom(body: Record<string, unknown>, ok: boolean, status: number, cfg: Awaited<ReturnType<typeof config>>): HostingDomainState {
    const verification = Array.isArray(body.verification)
      ? (body.verification as Array<{ type: string; domain: string; value: string }>)
      : [];
    const err = body.error as { code?: string; message?: string } | undefined;
    return {
      attached: ok,
      verified: ok ? body.verified !== false : false,
      configured: ok && body.verified !== false && cfg.configured,
      verification,
      recommendedIPv4: cfg.recommendedIPv4,
      recommendedCNAME: cfg.recommendedCNAME,
      error: ok ? null : hostingErrorMessage(status, err?.code, err?.message),
    };
  }

  return {
    configured: true,
    async add(domain) {
      const result = await call(`/v10/projects/${encodeURIComponent(project!)}/domains`, { method: "POST", body: JSON.stringify({ name: domain }) });
      if (!result.ok && result.status === 409) {
        // Already on this project — treat as attached and read its state.
        return this.status(domain);
      }
      const cfg = result.ok ? await config(domain) : { configured: false, recommendedIPv4: null, recommendedCNAME: null };
      return stateFrom(result.body, result.ok, result.status, cfg);
    },
    async status(domain) {
      const result = await call(`/v9/projects/${encodeURIComponent(project!)}/domains/${encodeURIComponent(domain)}`);
      const cfg = result.ok ? await config(domain) : { configured: false, recommendedIPv4: null, recommendedCNAME: null };
      return stateFrom(result.body, result.ok, result.status, cfg);
    },
    async verify(domain) {
      const result = await call(`/v9/projects/${encodeURIComponent(project!)}/domains/${encodeURIComponent(domain)}/verify`, { method: "POST" });
      if (!result.ok) return this.status(domain);
      const cfg = await config(domain);
      return stateFrom(result.body, true, result.status, cfg);
    },
    async remove(domain) {
      await call(`/v9/projects/${encodeURIComponent(project!)}/domains/${encodeURIComponent(domain)}`, { method: "DELETE" });
    },
  };
}

function hostingErrorMessage(status: number, code?: string, message?: string): string {
  if (code === "domain_already_in_use" || code === "domain_taken") return "That domain is attached to another site. Remove it there first, or contact support.";
  if (code === "invalid_domain") return "The hosting provider rejected that domain name.";
  if (status === 403) return "Halyard's hosting connection is not allowed to manage domains. The Halyard team needs to check the API token.";
  if (status === 429) return "Too many domain requests right now. Try again in a minute.";
  return message ? `Hosting provider: ${message}` : "The hosting provider could not attach that domain right now.";
}
