import {
  SourcingError,
  type FetchLike,
  type FulfillmentResult,
  type ProductSourceProvider,
  type ShippingQuote,
  type SourcedProduct,
  type SourcedSearchResult,
  type SourcingCapability,
  type SourcingCredentials,
  type TrackingResult,
} from "@/lib/sourcing/types";

/**
 * CJdropshipping provider (Open API v2).
 *
 * CJ is the practical first integration: each merchant self-serves an API key
 * from My CJ → API (format `CJUserNum@api@…`), so there is no platform-level
 * approval gate. Auth exchanges that key for a 180-day access token used as the
 * `CJ-Access-Token` header. Docs: https://developers.cjdropshipping.com/
 *
 * The account rate limit is ~1 request/second, so callers must cache and queue.
 * Fulfillment is paid from the merchant's CJ wallet balance, not by us.
 *
 * Every request is real; the adapter only needs a valid key. Without one it
 * throws SourcingError("not_configured"). Fetch is injected so this is unit
 * tested against the documented request shapes without live network access.
 */

const BASE = "https://developers.cjdropshipping.com/api2.0/v1";

const CAPS: ReadonlySet<SourcingCapability> = new Set([
  "search", "productDetails", "inventory", "shipping", "orders", "tracking",
]);

type TokenBundle = { accessToken: string };

async function authenticate(creds: SourcingCredentials, fetchImpl: FetchLike): Promise<TokenBundle> {
  const apiKey = creds.apiKey?.trim();
  const email = creds.email?.trim();
  if (!apiKey || !email) {
    throw new SourcingError("not_configured", "Connect a CJdropshipping account first.", "cjdropshipping");
  }
  const res = await fetchImpl(`${BASE}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: apiKey }),
  });
  const body = (await res.json()) as { result?: boolean; message?: string; data?: { accessToken?: string } };
  if (!res.ok || !body?.result || !body.data?.accessToken) {
    throw new SourcingError(
      res.status === 401 ? "auth" : "provider_error",
      body?.message || "CJdropshipping rejected these credentials.",
      "cjdropshipping",
    );
  }
  return { accessToken: body.data.accessToken };
}

async function call(
  token: TokenBundle,
  path: string,
  fetchImpl: FetchLike,
  init?: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> },
): Promise<unknown> {
  const qs = init?.query
    ? "?" + Object.entries(init.query)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const res = await fetchImpl(`${BASE}${path}${qs}`, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json", "CJ-Access-Token": token.accessToken },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const body = (await res.json()) as { result?: boolean; code?: number; message?: string; data?: unknown };
  if (res.status === 429) {
    throw new SourcingError("rate_limited", "CJdropshipping rate limit hit (1 req/sec). Retry shortly.", "cjdropshipping");
  }
  if (!res.ok || body?.result === false) {
    throw new SourcingError("provider_error", body?.message || `CJdropshipping error on ${path}.`, "cjdropshipping");
  }
  return body.data;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function mapProduct(raw: Record<string, unknown>): SourcedProduct {
  const variants = Array.isArray(raw.variants) ? (raw.variants as Array<Record<string, unknown>>) : [];
  const images = Array.isArray(raw.productImageSet)
    ? (raw.productImageSet as string[]).map((url, i) => ({ url, position: i }))
    : raw.productImage
      ? [{ url: String(raw.productImage), position: 0 }]
      : [];
  const mappedVariants = variants.map((v) => ({
    supplierVariantId: String(v.vid ?? v.variantId ?? ""),
    sku: (v.variantSku as string) ?? null,
    options: parseVariantKey(v.variantKey),
    supplierPrice: num(v.variantSellPrice ?? v.variantStandardPrice),
    inventory: num(v.variantQuantity),
    imageUrl: (v.variantImage as string) ?? null,
  }));
  const prices = mappedVariants.map((v) => v.supplierPrice).filter((p): p is number => p != null);
  return {
    provider: "cjdropshipping",
    supplierProductId: String(raw.pid ?? raw.productId ?? ""),
    title: String(raw.productNameEn ?? raw.productName ?? "Untitled"),
    description: (raw.description as string) ?? null,
    images,
    variants: mappedVariants,
    fromPrice: prices.length ? Math.min(...prices) : num(raw.sellPrice),
    currency: "USD",
    shippingNote: (raw.deliveryTime as string) ?? null,
    supplierUrl: raw.pid ? `https://cjdropshipping.com/product-detail/${raw.pid}` : null,
  };
}

function parseVariantKey(key: unknown): Record<string, string> {
  // CJ encodes variant options as "Black-M" against the product's option axes.
  if (typeof key !== "string" || !key) return {};
  return Object.fromEntries(key.split("-").map((part, i) => [`Option ${i + 1}`, part]));
}

export function createCjProvider(fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike): ProductSourceProvider {
  return {
    id: "cjdropshipping",
    name: "CJdropshipping",
    capabilities: CAPS,
    credentialFields: [
      { key: "email", label: "CJ account email" },
      { key: "apiKey", label: "CJ API key", secret: true },
    ],
    supports: (c) => CAPS.has(c),

    async searchProducts(creds, query) {
      const token = await authenticate(creds, fetchImpl);
      const data = (await call(token, "/product/list", fetchImpl, {
        query: {
          pageNum: query.page ?? 1,
          pageSize: query.pageSize ?? 20,
          productNameEn: query.keyword,
          categoryId: query.categoryId,
        },
      })) as { list?: Array<Record<string, unknown>>; total?: number } | null;
      const list = data?.list ?? [];
      return {
        products: list.map(mapProduct),
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        total: typeof data?.total === "number" ? data.total : null,
      } satisfies SourcedSearchResult;
    },

    async getProduct(creds, supplierProductId) {
      const token = await authenticate(creds, fetchImpl);
      const data = (await call(token, "/product/query", fetchImpl, {
        query: { pid: supplierProductId },
      })) as Record<string, unknown> | null;
      if (!data) throw new SourcingError("provider_error", "Product not found at CJdropshipping.", "cjdropshipping");
      return mapProduct(data);
    },

    async getInventory(creds, supplierVariantIds) {
      const token = await authenticate(creds, fetchImpl);
      const out: Record<string, number> = {};
      for (const vid of supplierVariantIds) {
        const data = (await call(token, "/product/stock/queryByVid", fetchImpl, { query: { vid } })) as
          | Array<{ storageNum?: number }>
          | null;
        out[vid] = Array.isArray(data) ? data.reduce((sum, s) => sum + (s.storageNum ?? 0), 0) : 0;
      }
      return out;
    },

    async getShippingQuotes(creds, input) {
      const token = await authenticate(creds, fetchImpl);
      const data = (await call(token, "/logistic/freightCalculate", fetchImpl, {
        method: "POST",
        body: { startCountryCode: "CN", endCountryCode: input.country, products: [{ vid: input.supplierVariantId, quantity: input.quantity }] },
      })) as Array<Record<string, unknown>> | null;
      return (data ?? []).map((q) => ({
        method: String(q.logisticName ?? "Standard"),
        carrier: (q.logisticName as string) ?? null,
        cost: num(q.logisticPrice) ?? 0,
        currency: "USD",
        minDays: num(q.logisticAgingMin),
        maxDays: num(q.logisticAgingMax),
      })) satisfies ShippingQuote[];
    },

    async createFulfillmentOrder(creds, input) {
      const token = await authenticate(creds, fetchImpl);
      const data = (await call(token, "/shopping/order/createOrderV3", fetchImpl, {
        method: "POST",
        body: {
          orderNumber: input.reference,
          shippingCountryCode: input.address.country,
          shippingProvince: input.address.region,
          shippingCity: input.address.city,
          shippingAddress: [input.address.line1, input.address.line2].filter(Boolean).join(", "),
          shippingCustomerName: input.address.name,
          shippingZip: input.address.postalCode,
          shippingPhone: input.address.phone ?? "",
          products: input.lines.map((l) => ({ vid: l.supplierVariantId, quantity: l.quantity })),
        },
      })) as { orderId?: string; orderStatus?: string } | null;
      if (!data?.orderId) throw new SourcingError("provider_error", "CJdropshipping did not return an order id.", "cjdropshipping");
      return {
        supplierOrderId: String(data.orderId),
        status: String(data.orderStatus ?? "CREATED"),
        totalCost: null,
        currency: "USD",
      } satisfies FulfillmentResult;
    },

    async getTracking(creds, supplierOrderId) {
      const token = await authenticate(creds, fetchImpl);
      const data = (await call(token, "/logistic/getTrackInfo", fetchImpl, {
        query: { orderId: supplierOrderId },
      })) as { trackingNumber?: string; logisticName?: string; trackingStatus?: string; routeList?: Array<Record<string, unknown>> } | null;
      return {
        trackingNumber: data?.trackingNumber ?? null,
        carrier: data?.logisticName ?? null,
        status: String(data?.trackingStatus ?? "UNKNOWN"),
        events: (data?.routeList ?? []).map((e) => ({
          at: String(e.date ?? ""),
          status: String(e.description ?? e.status ?? ""),
          location: (e.location as string) ?? undefined,
        })),
      } satisfies TrackingResult;
    },
  };
}
