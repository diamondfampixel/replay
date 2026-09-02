import { createCjProvider } from "@/lib/sourcing/providers/cjdropshipping";
import { createAliExpressProvider } from "@/lib/sourcing/providers/aliexpress";
import type { ProductSourceProvider, SourcingCapability } from "@/lib/sourcing/types";

/**
 * Registry of product-sourcing providers. New suppliers are added here and
 * everything downstream (importer, sync, fulfillment, the integrations UI)
 * discovers them through this one list — nothing is hard-coded to a single
 * provider.
 *
 * `readiness` is the honest connect-state of each provider:
 *   - "self_serve"    a merchant can connect today with their own API key
 *   - "needs_approval" the code is real but Halyard must hold an approved
 *                      developer app before any merchant can connect
 */
export type SourcingReadiness = "self_serve" | "needs_approval";

export type SourcingProviderMeta = {
  id: string;
  name: string;
  readiness: SourcingReadiness;
  capabilities: SourcingCapability[];
  /** One-line honest note shown in the UI. */
  note: string;
  docsUrl: string;
  create: () => ProductSourceProvider;
};

export const SOURCING_PROVIDERS: SourcingProviderMeta[] = [
  {
    id: "cjdropshipping",
    name: "CJdropshipping",
    readiness: "self_serve",
    capabilities: ["search", "productDetails", "inventory", "shipping", "orders", "tracking", "webhooks"],
    note: "Connect with your own CJ API key (My CJ → API). Full import, inventory, order and tracking sync. Fulfillment is paid from your CJ wallet balance; the API allows ~1 request/second.",
    docsUrl: "https://developers.cjdropshipping.com/",
    create: () => createCjProvider(),
  },
  {
    id: "aliexpress",
    name: "AliExpress",
    readiness: "needs_approval",
    capabilities: ["search", "productDetails"],
    note: "Requires an approved AliExpress Open Platform app (AppKey/AppSecret with the Dropshipping API entitlement) before merchants can authorize. Product search and import are implemented and signed; freight, order-create and tracking are documented under the same ds.* group and are a follow-up. No supplier webhooks (sync is by polling).",
    docsUrl: "https://openservice.aliexpress.com/",
    create: () => createAliExpressProvider(),
  },
];

export function getSourcingProvider(id: string): SourcingProviderMeta | undefined {
  return SOURCING_PROVIDERS.find((p) => p.id === id);
}
