import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestStore, createTestStore, testDb } from "./helpers";
import { dnsRecordsFor, normalizeDomain, isReservedHost } from "@/lib/domains/validate";
import { hostingClient, type HostingClient, type HostingDomainState } from "@/lib/domains/vercel";
import { checkDomain, connectDomain, disconnectDomain, getDomainView, resolveStoreByHost } from "@/lib/services/domains";
import type { ServiceContext } from "@/lib/services/context";

let a: { ctx: ServiceContext; organizationId: string; userId: string };
let b: { ctx: ServiceContext; organizationId: string; userId: string };

beforeAll(async () => {
  const one = await createTestStore("domains-a");
  const two = await createTestStore("domains-b");
  a = { ctx: one.ctx, organizationId: one.organization.id, userId: one.user.id };
  b = { ctx: two.ctx, organizationId: two.organization.id, userId: two.user.id };
});

afterAll(async () => {
  await cleanupTestStore(a.organizationId, a.userId);
  await cleanupTestStore(b.organizationId, b.userId);
});

describe("domain validation", () => {
  it("normalises what merchants actually type", () => {
    expect(normalizeDomain("  Courtline.COM ")).toEqual({ host: "courtline.com", kind: "apex", apex: "courtline.com" });
    expect(normalizeDomain("https://www.courtline.com/")).toEqual({ host: "www.courtline.com", kind: "www", apex: "courtline.com" });
    expect(normalizeDomain("shop.courtline.co.uk").kind).toBe("subdomain");
  });

  it("rejects malformed, reserved and platform hosts with plain reasons", () => {
    for (const bad of ["", "courtline", "court line.com", "http://", "192.168.0.1", "*.courtline.com", "-bad.com", "a..b.com", "me@courtline.com"]) {
      expect(() => normalizeDomain(bad), bad).toThrow();
    }
    expect(() => normalizeDomain("halyard.vercel.app")).toThrow(/belongs to Halyard/);
    expect(() => normalizeDomain("shop.halyard.example", ["halyard.example"])).toThrow(/belongs to Halyard/);
    expect(isReservedHost("localhost", [])).toBe(true);
  });

  it("gives an A record for the apex and a CNAME otherwise, plus TXT ownership records", () => {
    const apex = dnsRecordsFor(normalizeDomain("courtline.com"));
    expect(apex).toEqual([{ type: "A", name: "@", value: "76.76.21.21", purpose: expect.any(String) }]);
    const www = dnsRecordsFor(normalizeDomain("www.courtline.com"), { cname: "cname.vercel-dns-017.com" }, [
      { type: "TXT", domain: "_vercel.courtline.com", value: "vc-domain-verify=abc" },
    ]);
    expect(www[0]).toMatchObject({ type: "CNAME", name: "www", value: "cname.vercel-dns-017.com" });
    expect(www[1]).toMatchObject({ type: "TXT", name: "_vercel", value: "vc-domain-verify=abc" });
  });
});

function fakeClient(script: Partial<Record<"add" | "status" | "verify", HostingDomainState[]>>, calls: string[] = []): HostingClient {
  const base: HostingDomainState = { attached: true, verified: true, configured: false, verification: [], recommendedIPv4: null, recommendedCNAME: null, error: null };
  const next = (key: "add" | "status" | "verify") => script[key]?.shift() ?? base;
  return {
    configured: true,
    add: async (d) => { calls.push(`add:${d}`); return next("add"); },
    status: async (d) => { calls.push(`status:${d}`); return next("status"); },
    verify: async (d) => { calls.push(`verify:${d}`); return next("verify"); },
    remove: async (d) => { calls.push(`remove:${d}`); },
  };
}

describe("domain service", () => {
  it("connects, reports DNS required, then connects after the provider confirms", async () => {
    const calls: string[] = [];
    const client = fakeClient({
      add: [{ attached: true, verified: true, configured: false, verification: [], recommendedIPv4: "216.198.79.1", recommendedCNAME: null, error: null }],
      status: [{ attached: true, verified: true, configured: true, verification: [], recommendedIPv4: null, recommendedCNAME: null, error: null }],
    }, calls);

    const first = await connectDomain(a.ctx, "Courtline.com", client);
    expect(first.status).toBe("DNS_REQUIRED");
    expect(first.records[0]).toMatchObject({ type: "A", value: "216.198.79.1" });
    expect(calls).toEqual(["add:courtline.com"]);

    const view = await getDomainView(a.ctx, client);
    expect(view.host).toBe("courtline.com");
    expect(view.status).toBe("DNS_REQUIRED");
    expect(await resolveStoreByHost("courtline.com")).toBeNull();

    const checked = await checkDomain(a.ctx, client);
    expect(checked.status).toBe("CONNECTED");
    const store = await testDb.store.findUnique({ where: { id: a.ctx.storeId } });
    expect(store?.customDomainVerifiedAt).toBeTruthy();
    expect((await resolveStoreByHost("COURTLINE.com:443"))?.slug).toBe(store?.slug);
  });

  it("refuses a domain another store holds, without revealing who", async () => {
    await expect(connectDomain(b.ctx, "courtline.com", fakeClient({}))).rejects.toThrow(/already connected to another Halyard store/);
    await expect(connectDomain(b.ctx, "WWW.courtline.com", fakeClient({}))).resolves.toMatchObject({ host: "www.courtline.com" });
    await disconnectDomain(b.ctx, fakeClient({}));
  });

  it("surfaces ownership verification and provider errors as statuses", async () => {
    const client = fakeClient({
      add: [{ attached: true, verified: false, configured: false, verification: [{ type: "TXT", domain: "_vercel.shop.example.org", value: "vc-domain-verify=xyz" }], recommendedIPv4: null, recommendedCNAME: "cname.vercel-dns.com", error: null }],
      status: [{ attached: false, verified: false, configured: false, verification: [], recommendedIPv4: null, recommendedCNAME: null, error: "That domain is attached to another site. Remove it there first, or contact support." }],
    });
    const result = await connectDomain(b.ctx, "shop.example.org", client);
    expect(result.status).toBe("VERIFYING");
    expect(result.records.some((r) => r.type === "TXT" && r.name === "_vercel.shop")).toBe(true);

    const failing: HostingClient = { ...client, status: async () => ({ attached: false, verified: false, configured: false, verification: [], recommendedIPv4: null, recommendedCNAME: null, error: "That domain is attached to another site. Remove it there first, or contact support." }), add: async () => ({ attached: false, verified: false, configured: false, verification: [], recommendedIPv4: null, recommendedCNAME: null, error: "That domain is attached to another site. Remove it there first, or contact support." }) };
    const checked = await checkDomain(b.ctx, failing);
    expect(checked.status).toBe("ERROR");
    expect(checked.error).toMatch(/another site/);
    await disconnectDomain(b.ctx, client);
    expect((await getDomainView(b.ctx, client)).status).toBe("NOT_CONNECTED");
  });

  it("without a hosting connection it reserves the domain and says verification is deferred", async () => {
    delete process.env.VERCEL_API_TOKEN;
    const client = hostingClient();
    expect(client.configured).toBe(false);
    const result = await connectDomain(b.ctx, "reserve.example.net", client);
    expect(result.status).toBe("DNS_REQUIRED");
    expect(result.hostingReady).toBe(false);
    expect(await resolveStoreByHost("reserve.example.net")).toBeNull();
    await disconnectDomain(b.ctx, client);
  });

  it("only settings:write may change domains, and a store cannot see another store's domain", async () => {
    await expect(connectDomain({ ...b.ctx, role: "ANALYST" }, "x.example.com", fakeClient({}))).rejects.toThrow(/settings:write/);
    const view = await getDomainView(b.ctx, fakeClient({}));
    expect(view.host).toBeNull();
    await disconnectDomain(a.ctx, fakeClient({}));
  });
});

describe("hosting client against a fake Vercel API", () => {
  it("parses add/config/verify responses and error codes", async () => {
    process.env.VERCEL_API_TOKEN = "test-token-not-real";
    process.env.VERCEL_PROJECT_ID = "prj_test";
    const seen: string[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      seen.push(`${init?.method ?? "GET"} ${new URL(url).pathname}`);
      if (url.includes("/domains/taken.example.com") && !url.endsWith("/config")) {
        return new Response(JSON.stringify({ error: { code: "domain_already_in_use", message: "in use" } }), { status: 409 });
      }
      if (url.endsWith("/config")) return new Response(JSON.stringify({ misconfigured: true, recommendedIPv4: ["216.198.79.1"] }), { status: 200 });
      if (url.endsWith("/verify")) return new Response(JSON.stringify({ name: "ok.example.com", verified: true }), { status: 200 });
      return new Response(JSON.stringify({ name: "ok.example.com", verified: false, verification: [{ type: "TXT", domain: "_vercel.ok.example.com", value: "vc-domain-verify=1" }] }), { status: 200 });
    };
    const client = hostingClient(fakeFetch);
    expect(client.configured).toBe(true);
    const added = await client.add("ok.example.com");
    expect(added).toMatchObject({ attached: true, verified: false, configured: false, recommendedIPv4: "216.198.79.1" });
    expect(added.verification[0].value).toBe("vc-domain-verify=1");
    const verified = await client.verify("ok.example.com");
    expect(verified.verified).toBe(true);
    const taken = await client.status("taken.example.com");
    expect(taken.attached).toBe(false);
    expect(taken.error).toMatch(/another site/);
    expect(seen[0]).toBe("POST /v10/projects/prj_test/domains");
    delete process.env.VERCEL_API_TOKEN;
    delete process.env.VERCEL_PROJECT_ID;
  });
});
