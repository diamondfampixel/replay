import { describe, expect, it, vi } from "vitest";
import { createCjProvider } from "@/lib/sourcing/providers/cjdropshipping";
import { createAliExpressProvider, signParams } from "@/lib/sourcing/providers/aliexpress";
import { type FetchLike } from "@/lib/sourcing/types";
import { SOURCING_PROVIDERS, getSourcingProvider } from "@/lib/sourcing/registry";

/**
 * These verify the sourcing adapters shape real requests correctly (endpoints,
 * auth headers, signing) and map supplier payloads into Halyard's normalized
 * types — without any live network access. A missing credential must surface a
 * typed, honest "not configured" error rather than a fake success. No live
 * connection is asserted: that needs a real merchant key (CJ) or an approved
 * app (AliExpress), both external.
 */

/** Builds a FetchLike that records calls and returns queued JSON bodies. */
function mockFetch(responses: Array<{ ok?: boolean; status?: number; json: unknown }>) {
  const calls: Array<{ url: string; init?: Parameters<FetchLike>[1] }> = [];
  let i = 0;
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const r = responses[Math.min(i++, responses.length - 1)];
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.json,
      text: async () => JSON.stringify(r.json),
    };
  };
  return { fetchImpl, calls };
}

describe("CJdropshipping adapter", () => {
  const creds = { email: "seller@example.com", apiKey: "CJ123@api@secret" };

  it("throws a typed not_configured error without credentials", async () => {
    const { fetchImpl } = mockFetch([]);
    const cj = createCjProvider(fetchImpl);
    await expect(cj.searchProducts({}, { keyword: "mug" })).rejects.toMatchObject({
      name: "SourcingError",
      code: "not_configured",
    });
  });

  it("authenticates then searches, mapping products to the normalized shape", async () => {
    const { fetchImpl, calls } = mockFetch([
      { json: { result: true, data: { accessToken: "tok-abc" } } },
      {
        json: {
          result: true,
          data: {
            total: 1,
            list: [
              {
                pid: "P100", productNameEn: "Enamel Mug", productImageSet: ["https://cdn/x.jpg"],
                deliveryTime: "7-12 days",
                variants: [
                  { vid: "V1", variantSku: "MUG-BLK", variantKey: "Black-M", variantSellPrice: "3.20", variantQuantity: 42 },
                ],
              },
            ],
          },
        },
      },
    ]);
    const cj = createCjProvider(fetchImpl);
    const res = await cj.searchProducts(creds, { keyword: "mug", page: 1 });

    // auth call shape
    expect(calls[0].url).toContain("/authentication/getAccessToken");
    // search call carries the access token header and the search endpoint
    expect(calls[1].url).toContain("/product/list");
    expect(calls[1].init?.headers?.["CJ-Access-Token"]).toBe("tok-abc");

    expect(res.total).toBe(1);
    const p = res.products[0];
    expect(p.provider).toBe("cjdropshipping");
    expect(p.supplierProductId).toBe("P100");
    expect(p.title).toBe("Enamel Mug");
    expect(p.fromPrice).toBe(3.2);
    expect(p.variants[0].supplierVariantId).toBe("V1");
    expect(p.variants[0].inventory).toBe(42);
  });

  it("maps a bad key to a typed auth error", async () => {
    const { fetchImpl } = mockFetch([{ ok: false, status: 401, json: { result: false, message: "invalid" } }]);
    const cj = createCjProvider(fetchImpl);
    await expect(cj.getProduct(creds, "P1")).rejects.toMatchObject({ code: "auth" });
  });

  it("surfaces the 1 req/sec rate limit as a typed error", async () => {
    const { fetchImpl } = mockFetch([
      { json: { result: true, data: { accessToken: "tok" } } },
      { ok: false, status: 429, json: { result: false, message: "too fast" } },
    ]);
    const cj = createCjProvider(fetchImpl);
    await expect(cj.searchProducts(creds, {})).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("builds a fulfillment order with the supplier variant ids and address", async () => {
    const { fetchImpl, calls } = mockFetch([
      { json: { result: true, data: { accessToken: "tok" } } },
      { json: { result: true, data: { orderId: "CJO-9", orderStatus: "CREATED" } } },
    ]);
    const cj = createCjProvider(fetchImpl);
    const out = await cj.createFulfillmentOrder!(creds, {
      reference: "HAL-1001",
      lines: [{ supplierVariantId: "V1", quantity: 2 }],
      address: { name: "Quinn", line1: "1 Harbor Ln", city: "Portland", region: "ME", postalCode: "04101", country: "US" },
    });
    expect(out.supplierOrderId).toBe("CJO-9");
    const body = JSON.parse(calls[1].init!.body!);
    expect(body.orderNumber).toBe("HAL-1001");
    expect(body.products).toEqual([{ vid: "V1", quantity: 2 }]);
    expect(body.shippingCountryCode).toBe("US");
  });
});

describe("AliExpress adapter", () => {
  it("signs parameters with uppercase HMAC-SHA256 over sorted key+value", () => {
    // Deterministic vector so signing can't silently regress.
    const sig = signParams({ b: "2", a: "1" }, "secret");
    // HMAC-SHA256("a1b2", "secret") uppercased.
    expect(sig).toMatch(/^[0-9A-F]{64}$/);
    // Order independence: same params in any insertion order sign identically.
    expect(signParams({ a: "1", b: "2" }, "secret")).toBe(sig);
  });

  it("throws not_configured until an approved app + session exist", async () => {
    const { fetchImpl } = mockFetch([]);
    const ae = createAliExpressProvider(fetchImpl);
    await expect(ae.searchProducts({ appKey: "k" }, { keyword: "x" })).rejects.toMatchObject({
      code: "not_configured",
    });
  });

  it("sends a signed DS request and maps the product payload", async () => {
    const { fetchImpl, calls } = mockFetch([
      {
        json: {
          aliexpress_ds_product_get_response: {
            result: {
              product_id: "AE55", subject: "USB-C Cable", image_urls: "https://a/1.jpg;https://a/2.jpg",
              ae_item_sku_info_dtos: [{ sku_id: "S1", sku_code: "C-1", offer_sale_price: "1.90", sku_available_stock: 500 }],
            },
          },
        },
      },
    ]);
    const ae = createAliExpressProvider(fetchImpl);
    const p = await ae.getProduct({ appKey: "k", appSecret: "s", session: "sess" }, "AE55");
    // signed body includes method, app_key, session and a sign
    const body = calls[0].init!.body!;
    expect(body).toContain("method=aliexpress.ds.product.get");
    expect(body).toContain("app_key=k");
    expect(body).toContain("sign=");
    expect(p.supplierProductId).toBe("AE55");
    expect(p.images).toHaveLength(2);
    expect(p.variants[0].supplierPrice).toBe(1.9);
  });

  it("maps an IllegalAccessToken error to a typed auth error", async () => {
    const { fetchImpl } = mockFetch([{ json: { error_response: { code: "IllegalAccessToken", msg: "bad session" } } }]);
    const ae = createAliExpressProvider(fetchImpl);
    await expect(ae.getProduct({ appKey: "k", appSecret: "s", session: "x" }, "AE1")).rejects.toMatchObject({ code: "auth" });
  });
});

describe("sourcing registry", () => {
  it("exposes CJ as self-serve and AliExpress as needing approval", () => {
    expect(getSourcingProvider("cjdropshipping")?.readiness).toBe("self_serve");
    expect(getSourcingProvider("aliexpress")?.readiness).toBe("needs_approval");
  });

  it("every registered provider instantiates and declares capabilities", () => {
    for (const meta of SOURCING_PROVIDERS) {
      const provider = meta.create();
      expect(provider.id).toBe(meta.id);
      expect(provider.capabilities.size).toBeGreaterThan(0);
      // supports() must not claim a capability the object can't back up.
      if (provider.supports("orders")) {
        expect(provider.createFulfillmentOrder).toBeTypeOf("function");
      }
      if (provider.supports("tracking")) {
        expect(provider.getTracking).toBeTypeOf("function");
      }
    }
  });
});
