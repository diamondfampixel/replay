/**
 * Custom-domain validation and DNS guidance. Pure: no network, no database.
 *
 * A merchant types "courtline.com" or "shop.courtline.com"; this decides
 * whether that is a hostname Halyard can route, and which DNS record their
 * registrar needs. Apex domains take an A record, everything else a CNAME —
 * the values are Vercel's published defaults unless the hosting API reports
 * project-specific ones.
 */
export type DomainKind = "apex" | "www" | "subdomain";

export type DnsRecord = { type: "A" | "CNAME" | "TXT"; name: string; value: string; purpose: string };

export const VERCEL_DEFAULT_A = "76.76.21.21";
export const VERCEL_DEFAULT_CNAME = "cname.vercel-dns.com";

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** Hosts that are Halyard's own or cannot be claimed by a merchant. */
export function isReservedHost(host: string, platformHosts: string[]): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".vercel.app") || h.endsWith(".vercel-dns.com")) return true;
  return platformHosts.some((p) => p && (h === p || h.endsWith(`.${p}`)));
}

export type NormalizedDomain = { host: string; kind: DomainKind; apex: string };

/** Returns the normalised host or throws with a merchant-readable reason. */
export function normalizeDomain(raw: string, platformHosts: string[] = []): NormalizedDomain {
  let value = (raw ?? "").trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  if (!value) throw new DomainError("Enter the domain you own, like courtline.com.");
  if (value.includes("@") || /\s/.test(value)) throw new DomainError("That doesn't look like a domain name.");
  if (/[^a-z0-9.-]/.test(value)) throw new DomainError("Domains can only contain letters, numbers, hyphens and dots. Internationalised names need their punycode form.");
  const labels = value.split(".");
  if (labels.length < 2) throw new DomainError("Enter the full domain, like courtline.com — not just a word.");
  if (!labels.every((label) => LABEL.test(label))) throw new DomainError("One part of that domain is not valid. Check for double dots or stray hyphens.");
  if (value.length > 253) throw new DomainError("That domain is too long.");
  if (/^\d+(\.\d+){3}$/.test(value)) throw new DomainError("Enter a domain name, not an IP address.");
  if (value.startsWith("*.")) throw new DomainError("Wildcard domains aren't supported. Enter a specific hostname.");
  if (isReservedHost(value, platformHosts)) throw new DomainError("That address belongs to Halyard. Enter a domain you own.");

  const kind: DomainKind = labels.length === 2 ? "apex" : labels[0] === "www" && labels.length === 3 ? "www" : "subdomain";
  const apex = labels.slice(-2).join(".");
  return { host: value, kind, apex };
}

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** The records a registrar needs, given what the hosting API recommends (or the defaults). */
export function dnsRecordsFor(
  domain: NormalizedDomain,
  recommended: { ipv4?: string | null; cname?: string | null } = {},
  verification: Array<{ type: string; domain: string; value: string }> = [],
): DnsRecord[] {
  const records: DnsRecord[] = [];
  if (domain.kind === "apex") {
    records.push({ type: "A", name: "@", value: recommended.ipv4 || VERCEL_DEFAULT_A, purpose: "Points your root domain at your store" });
  } else {
    const name = domain.host.slice(0, -(domain.apex.length + 1));
    records.push({ type: "CNAME", name, value: recommended.cname || VERCEL_DEFAULT_CNAME, purpose: `Points ${domain.host} at your store` });
  }
  for (const item of verification) {
    if (item.type.toUpperCase() !== "TXT") continue;
    const name = item.domain.endsWith(`.${domain.apex}`) ? item.domain.slice(0, -(domain.apex.length + 1)) : item.domain;
    records.push({ type: "TXT", name, value: item.value, purpose: "Proves you own the domain" });
  }
  return records;
}

export const DOMAIN_STATUSES = ["NOT_CONNECTED", "DNS_REQUIRED", "VERIFYING", "CONNECTED", "ERROR"] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

export const DOMAIN_STATUS_LABEL: Record<DomainStatus, string> = {
  NOT_CONNECTED: "Not connected",
  DNS_REQUIRED: "DNS required",
  VERIFYING: "Verifying",
  CONNECTED: "Connected",
  ERROR: "Needs attention",
};
