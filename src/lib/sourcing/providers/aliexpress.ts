import { createHmac } from "node:crypto";
import {
  SourcingError,
  type FetchLike,
  type ProductSourceProvider,
  type SourcedProduct,
  type SourcedSearchResult,
  type SourcingCapability,
  type SourcingCredentials,
} from "@/lib/sourcing/types";

/**
 * AliExpress provider (Open Platform Dropshipping API — `aliexpress.ds.*`).
 *
 * Unlike CJ, AliExpress gates the DS API behind developer registration and an
 * app review: the merchant/app needs an AppKey + AppSecret and DS-category
 * approval, and each merchant authorizes via OAuth to yield a `session` token.
 * Docs: https://openservice.aliexpress.com/doc/api.htm. Because of that
 * approval gate this provider is wired but not connectable until Halyard holds
 * an approved app (see the launch blockers) — the code and signing are real and
 * unit-tested; it simply has no credentials to run against yet.
 *
 * Requests are TOP-style: system params + HMAC-SHA256 signature over the
 * sorted parameter string, keyed by the AppSecret. Method names verified
 * against a working community SDK.
 */

const GATEWAY = "https://api-sg.aliexpress.com/sync";

// What this adapter *actually implements* today. AliExpress documents freight,
// order-create and tracking under the same ds.* group (and the signing here
// covers them), but they are not wired into methods yet — so supports() must
// not claim them. It stays honest: read/import works; fulfillment is a
// follow-up gated on the same app approval that blocks connecting at all.
const CAPS: ReadonlySet<SourcingCapability> = new Set([
  "search", "productDetails",
]);

/** TOP signature: uppercase HMAC-SHA256 hex of the sorted key+value string. */
export function signParams(params: Record<string, string>, appSecret: string): string {
  const sorted = Object.keys(params).sort();
  const base = sorted.map((k) => `${k}${params[k]}`).join("");
  return createHmac("sha256", appSecret).update(base, "utf8").digest("hex").toUpperCase();
}

function requireCreds(creds: SourcingCredentials) {
  const appKey = creds.appKey?.trim();
  const appSecret = creds.appSecret?.trim();
  const session = creds.session?.trim();
  if (!appKey || !appSecret || !session) {
    throw new SourcingError(
      "not_configured",
      "AliExpress needs an approved Open Platform app (AppKey/AppSecret) and a merchant OAuth session.",
      "aliexpress",
    );
  }
  return { appKey, appSecret, session };
}

async function callMethod(
  creds: SourcingCredentials,
  method: string,
  apiParams: Record<string, string>,
  fetchImpl: FetchLike,
): Promise<unknown> {
  const { appKey, appSecret, session } = requireCreds(creds);
  const sys: Record<string, string> = {
    method,
    app_key: appKey,
    session,
    timestamp: String(Date.now()),
    format: "json",
    v: "2.0",
    sign_method: "sha256",
    ...apiParams,
  };
  sys.sign = signParams(sys, appSecret);
  const body = new URLSearchParams(sys).toString();
  const res = await fetchImpl(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (json.error_response) {
    const err = json.error_response as { msg?: string; code?: string };
    throw new SourcingError(
      err.code === "IllegalAccessToken" ? "auth" : "provider_error",
      err.msg || "AliExpress returned an error.",
      "aliexpress",
    );
  }
  return json;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function mapProduct(raw: Record<string, unknown>): SourcedProduct {
  const skus = Array.isArray(raw.ae_item_sku_info_dtos) ? (raw.ae_item_sku_info_dtos as Array<Record<string, unknown>>) : [];
  const images = typeof raw.image_urls === "string" ? raw.image_urls.split(";").filter(Boolean) : [];
  const variants = skus.map((s) => ({
    supplierVariantId: String(s.sku_id ?? s.id ?? ""),
    sku: (s.sku_code as string) ?? null,
    options: {} as Record<string, string>,
    supplierPrice: num(s.offer_sale_price ?? s.sku_price),
    inventory: num(s.sku_available_stock),
    imageUrl: null,
  }));
  const prices = variants.map((v) => v.supplierPrice).filter((p): p is number => p != null);
  return {
    provider: "aliexpress",
    supplierProductId: String(raw.product_id ?? ""),
    title: String(raw.subject ?? "Untitled"),
    description: (raw.description as string) ?? null,
    images: images.map((url, i) => ({ url, position: i })),
    variants,
    fromPrice: prices.length ? Math.min(...prices) : null,
    currency: "USD",
    shippingNote: null,
    supplierUrl: raw.product_id ? `https://www.aliexpress.com/item/${raw.product_id}.html` : null,
  };
}

export function createAliExpressProvider(fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike): ProductSourceProvider {
  return {
    id: "aliexpress",
    name: "AliExpress",
    capabilities: CAPS,
    credentialFields: [
      { key: "appKey", label: "App key" },
      { key: "appSecret", label: "App secret", secret: true },
      { key: "session", label: "Merchant OAuth session token", secret: true },
    ],
    supports: (c) => CAPS.has(c),

    async searchProducts(creds, query) {
      const json = (await callMethod(creds, "aliexpress.ds.text.search", {
        keyWord: query.keyword ?? "",
        pageIndex: String(query.page ?? 1),
        pageSize: String(query.pageSize ?? 20),
      }, fetchImpl)) as Record<string, unknown>;
      const resp = (json["aliexpress_ds_text_search_response"] ?? {}) as Record<string, unknown>;
      const products = Array.isArray((resp.data as Record<string, unknown>)?.products)
        ? ((resp.data as Record<string, unknown>).products as Array<Record<string, unknown>>)
        : [];
      return {
        products: products.map(mapProduct),
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        total: num((resp.data as Record<string, unknown>)?.total_count),
      } satisfies SourcedSearchResult;
    },

    async getProduct(creds, supplierProductId) {
      const json = (await callMethod(creds, "aliexpress.ds.product.get", {
        product_id: supplierProductId,
        ship_to_country: "US",
        target_currency: "USD",
        target_language: "en",
      }, fetchImpl)) as Record<string, unknown>;
      const resp = (json["aliexpress_ds_product_get_response"] ?? {}) as Record<string, unknown>;
      const result = (resp.result ?? resp.data) as Record<string, unknown> | undefined;
      if (!result) throw new SourcingError("provider_error", "Product not found at AliExpress.", "aliexpress");
      return mapProduct(result);
    },
  };
}
