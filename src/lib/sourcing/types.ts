/**
 * Product-sourcing / dropshipping provider abstraction.
 *
 * Halyard is not hard-coded around one supplier. Every sourcing provider
 * (CJdropshipping, AliExpress, and future ones) implements the same
 * `ProductSourceProvider` interface and returns the same normalized shapes,
 * so the importer, inventory sync and fulfillment code never know which
 * supplier they are talking to.
 *
 * Nothing here fabricates a connection. A provider only returns data when it
 * is given real credentials; without them each method throws a typed
 * `SourcingError` the UI can show honestly.
 */

export type SourcingCapability =
  | "search" // keyword/category product search
  | "productDetails" // full product incl. images, description, variants
  | "inventory" // live stock levels
  | "shipping" // freight/shipping quotes
  | "orders" // place a fulfillment order with the supplier
  | "tracking" // fetch tracking for a placed order
  | "webhooks"; // supplier pushes stock/order/tracking updates

export type SourcedImage = { url: string; position: number };

export type SourcedVariant = {
  /** Supplier's own variant/SKU id — stored so we can reorder and sync. */
  supplierVariantId: string;
  sku: string | null;
  /** Human option map, e.g. { Color: "Black", Size: "M" }. */
  options: Record<string, string>;
  /** Supplier (cost) price in the supplier's currency, major units. */
  supplierPrice: number | null;
  inventory: number | null;
  imageUrl: string | null;
};

export type SourcedProduct = {
  /** Provider id, e.g. "cjdropshipping". */
  provider: string;
  /** Supplier's own product id — the stable key for reordering & sync. */
  supplierProductId: string;
  title: string;
  description: string | null;
  images: SourcedImage[];
  variants: SourcedVariant[];
  /** Lowest supplier price across variants, for list views. */
  fromPrice: number | null;
  currency: string;
  /** Stated dispatch/delivery window, verbatim from the supplier. */
  shippingNote: string | null;
  supplierUrl: string | null;
};

export type SourcedSearchResult = {
  products: SourcedProduct[];
  page: number;
  pageSize: number;
  /** Total results if the supplier reports it. */
  total: number | null;
};

export type ShippingQuote = {
  method: string;
  carrier: string | null;
  cost: number;
  currency: string;
  minDays: number | null;
  maxDays: number | null;
};

export type FulfillmentLine = { supplierVariantId: string; quantity: number };

export type FulfillmentAddress = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string; // ISO-2
  phone?: string;
  email?: string;
};

export type FulfillmentResult = {
  /** Supplier's order id, stored on the Halyard order for later tracking. */
  supplierOrderId: string;
  status: string;
  totalCost: number | null;
  currency: string | null;
};

export type TrackingEvent = { at: string; status: string; location?: string };
export type TrackingResult = {
  trackingNumber: string | null;
  carrier: string | null;
  status: string;
  events: TrackingEvent[];
};

/** Per-merchant credentials, read from the stored Integration config. */
export type SourcingCredentials = Record<string, string>;

export type SourcingErrorCode =
  | "not_configured" // no credentials stored
  | "auth" // credentials rejected by the supplier
  | "rate_limited"
  | "not_supported" // provider does not implement this capability
  | "provider_error"; // supplier returned an error

export class SourcingError extends Error {
  constructor(
    readonly code: SourcingErrorCode,
    message: string,
    readonly provider?: string,
  ) {
    super(message);
    this.name = "SourcingError";
  }
}

export type ProductSourceProvider = {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ReadonlySet<SourcingCapability>;
  /** Credential fields this provider needs, mirrored in the integration UI. */
  readonly credentialFields: Array<{ key: string; label: string; secret?: boolean }>;

  supports(capability: SourcingCapability): boolean;

  searchProducts(
    creds: SourcingCredentials,
    query: { keyword?: string; categoryId?: string; page?: number; pageSize?: number },
  ): Promise<SourcedSearchResult>;

  getProduct(creds: SourcingCredentials, supplierProductId: string): Promise<SourcedProduct>;

  getInventory?(creds: SourcingCredentials, supplierVariantIds: string[]): Promise<Record<string, number>>;

  getShippingQuotes?(
    creds: SourcingCredentials,
    input: { supplierVariantId: string; quantity: number; country: string },
  ): Promise<ShippingQuote[]>;

  createFulfillmentOrder?(
    creds: SourcingCredentials,
    input: { lines: FulfillmentLine[]; address: FulfillmentAddress; reference: string },
  ): Promise<FulfillmentResult>;

  getTracking?(creds: SourcingCredentials, supplierOrderId: string): Promise<TrackingResult>;
};

/** Injectable fetch so adapters are unit-testable without real network access. */
export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;
