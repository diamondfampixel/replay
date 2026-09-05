import "server-only";
import { prisma } from "@/lib/db";
import { audit, authorize, NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";
import {
  dnsRecordsFor, normalizeDomain, DomainError, type DnsRecord, type DomainStatus, type NormalizedDomain,
} from "@/lib/domains/validate";
import { hostingClient, isHostingConfigured, type HostingClient, type HostingDomainState } from "@/lib/domains/vercel";
import { reportAlert } from "@/lib/monitoring";

/** Hostnames that belong to Halyard itself and can never be claimed by a merchant. */
export function platformHosts(): string[] {
  const hosts: string[] = [];
  try {
    if (process.env.NEXT_PUBLIC_APP_URL) hosts.push(new URL(process.env.NEXT_PUBLIC_APP_URL).hostname);
  } catch {
    /* ignore */
  }
  for (const extra of (process.env.HALYARD_PLATFORM_HOSTS ?? "").split(",")) {
    if (extra.trim()) hosts.push(extra.trim().toLowerCase());
  }
  return hosts;
}

export type DomainView = {
  host: string | null;
  kind: NormalizedDomain["kind"] | null;
  status: DomainStatus;
  error: string | null;
  verifiedAt: Date | null;
  checkedAt: Date | null;
  records: DnsRecord[];
  /** False until Halyard's hosting connection exists; the UI says so. */
  hostingReady: boolean;
  fallbackPath: string;
};

function toValidation(error: unknown): never {
  if (error instanceof DomainError) throw new ValidationError(error.message);
  throw error;
}

function statusFrom(state: HostingDomainState, hostingReady: boolean): { status: DomainStatus; error: string | null } {
  if (!hostingReady) return { status: "DNS_REQUIRED", error: null };
  if (state.error) return { status: "ERROR", error: state.error };
  if (!state.attached) return { status: "ERROR", error: "The domain could not be attached." };
  if (!state.verified) return { status: "VERIFYING", error: null };
  if (!state.configured) return { status: "DNS_REQUIRED", error: null };
  return { status: "CONNECTED", error: null };
}

export async function getDomainView(ctx: ServiceContext, client: HostingClient = hostingClient()): Promise<DomainView> {
  authorize(ctx, "settings:read");
  const store = await prisma.store.findUniqueOrThrow({
    where: { id: ctx.storeId },
    select: { slug: true, customDomain: true, customDomainStatus: true, customDomainError: true, customDomainVerifiedAt: true, customDomainCheckedAt: true },
  });
  const hostingReady = client.configured;
  if (!store.customDomain) {
    return { host: null, kind: null, status: "NOT_CONNECTED", error: null, verifiedAt: null, checkedAt: null, records: [], hostingReady, fallbackPath: `/s/${store.slug}` };
  }
  const domain = normalizeDomain(store.customDomain, []);
  return {
    host: domain.host,
    kind: domain.kind,
    status: store.customDomainStatus as DomainStatus,
    error: store.customDomainError,
    verifiedAt: store.customDomainVerifiedAt,
    checkedAt: store.customDomainCheckedAt,
    records: dnsRecordsFor(domain),
    hostingReady,
    fallbackPath: `/s/${store.slug}`,
  };
}

/**
 * Claims a domain for the caller's store: validated, unique across every
 * tenant (case-insensitively — the column stores lowercase), then handed to
 * the hosting provider. The merchant sees the DNS records immediately; the
 * status only becomes CONNECTED after the provider confirms ownership and DNS.
 */
export async function connectDomain(ctx: ServiceContext, raw: string, client: HostingClient = hostingClient()) {
  authorize(ctx, "settings:write");
  let domain: NormalizedDomain;
  try {
    domain = normalizeDomain(raw, platformHosts());
  } catch (error) {
    toValidation(error);
  }

  const owner = await prisma.store.findUnique({ where: { customDomain: domain.host }, select: { id: true } });
  if (owner && owner.id !== ctx.storeId) {
    // Same message whether the other store is ours or a stranger's: the
    // response must not reveal which domains other merchants have claimed.
    throw new ValidationError("That domain is already connected to another Halyard store. If you own it and this is unexpected, contact support.");
  }

  const current = await prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { customDomain: true } });
  if (current.customDomain && current.customDomain !== domain.host) {
    await client.remove(current.customDomain).catch(() => undefined);
  }

  const state = await client.add(domain.host);
  const { status, error } = statusFrom(state, client.configured);

  const store = await prisma.store.update({
    where: { id: ctx.storeId },
    data: {
      customDomain: domain.host,
      customDomainStatus: status,
      customDomainError: error,
      customDomainVerifiedAt: status === "CONNECTED" ? new Date() : null,
      customDomainCheckedAt: new Date(),
    },
    select: { slug: true },
  });
  await audit(ctx, "domain.connect", { type: "Store", id: ctx.storeId }, { host: domain.host, status });

  return {
    host: domain.host,
    kind: domain.kind,
    status,
    error,
    records: dnsRecordsFor(domain, { ipv4: state.recommendedIPv4, cname: state.recommendedCNAME }, state.verification),
    hostingReady: client.configured,
    fallbackPath: `/s/${store.slug}`,
  };
}

/** "Check again": re-reads ownership and DNS from the hosting provider. */
export async function checkDomain(ctx: ServiceContext, client: HostingClient = hostingClient()) {
  authorize(ctx, "settings:write");
  const store = await prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { customDomain: true, customDomainStatus: true } });
  if (!store.customDomain) throw new NotFoundError("Domain");
  const domain = normalizeDomain(store.customDomain, []);

  let state = await client.status(domain.host);
  if (client.configured && state.attached && !state.verified) state = await client.verify(domain.host);
  if (client.configured && !state.attached) state = await client.add(domain.host);

  const { status, error } = statusFrom(state, client.configured);
  const becameConnected = status === "CONNECTED" && store.customDomainStatus !== "CONNECTED";
  await prisma.store.update({
    where: { id: ctx.storeId },
    data: {
      customDomainStatus: status,
      customDomainError: error,
      customDomainCheckedAt: new Date(),
      ...(becameConnected ? { customDomainVerifiedAt: new Date() } : status !== "CONNECTED" ? { customDomainVerifiedAt: null } : {}),
    },
  });
  if (becameConnected) await audit(ctx, "domain.connected", { type: "Store", id: ctx.storeId }, { host: domain.host });
  if (status === "ERROR") reportAlert("domains/check", `Domain check failed for a store: ${error}`, { storeId: ctx.storeId });

  return {
    host: domain.host,
    kind: domain.kind,
    status,
    error,
    records: dnsRecordsFor(domain, { ipv4: state.recommendedIPv4, cname: state.recommendedCNAME }, state.verification),
    hostingReady: client.configured,
  };
}

export async function disconnectDomain(ctx: ServiceContext, client: HostingClient = hostingClient()) {
  authorize(ctx, "settings:write");
  const store = await prisma.store.findUniqueOrThrow({ where: { id: ctx.storeId }, select: { customDomain: true } });
  if (!store.customDomain) return;
  await client.remove(store.customDomain).catch(() => undefined);
  await prisma.store.update({
    where: { id: ctx.storeId },
    data: { customDomain: null, customDomainStatus: "NOT_CONNECTED", customDomainError: null, customDomainVerifiedAt: null, customDomainCheckedAt: null },
  });
  await audit(ctx, "domain.disconnect", { type: "Store", id: ctx.storeId }, { host: store.customDomain });
}

/**
 * Host → store slug for the request router. Only CONNECTED domains route, so
 * a domain that was claimed but never verified cannot serve a storefront.
 */
export async function resolveStoreByHost(host: string): Promise<{ slug: string } | null> {
  const normalized = host.toLowerCase().replace(/:\d+$/, "");
  if (!normalized || normalized.length > 253) return null;
  const store = await prisma.store.findFirst({
    where: { customDomain: normalized, customDomainStatus: "CONNECTED" },
    select: { slug: true },
  });
  return store;
}

export { isHostingConfigured };
