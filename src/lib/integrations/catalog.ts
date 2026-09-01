/**
 * Integration marketplace catalog.
 *
 * `implementation` is the honest status of each connector in this codebase:
 *   - "live"       the connector performs real API calls once credentials exist
 *   - "credentials" credentials can be stored and validated, but no data flows yet
 *   - "planned"    a slot only; nothing is wired up
 *
 * Nothing here fabricates an API. A connector is only "live" when this
 * repository actually contains the code that talks to the provider.
 */

export type IntegrationCategory =
  | "payments"
  | "email"
  | "analytics"
  | "advertising"
  | "social"
  | "fulfillment"
  | "reviews"
  | "automation"
  | "support"
  | "domains"
  | "accounting"
  | "ai";

export type IntegrationImplementation = "live" | "credentials" | "planned";

export type IntegrationDefinition = {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  implementation: IntegrationImplementation;
  /** What connecting actually does today. Shown verbatim in the UI. */
  capability: string;
  /** Credential fields collected when connecting. Stored server-side only. */
  fields: Array<{
    key: string;
    label: string;
    placeholder?: string;
    secret?: boolean;
    optional?: boolean;
    help?: string;
  }>;
  /** Environment variable that can supply the credential instead of the UI. */
  envVar?: string;
  docsUrl?: string;
  /** Simple monogram used as the card mark — no third-party logos are shipped. */
  mark: string;
  accent: string;
};

export const INTEGRATION_CATEGORIES: Array<{ id: IntegrationCategory; label: string }> = [
  { id: "payments", label: "Payments" },
  { id: "email", label: "Email" },
  { id: "analytics", label: "Analytics" },
  { id: "advertising", label: "Advertising" },
  { id: "social", label: "Social" },
  { id: "fulfillment", label: "Fulfillment" },
  { id: "reviews", label: "Reviews" },
  { id: "automation", label: "Automation" },
  { id: "support", label: "Customer support" },
  { id: "domains", label: "Domains" },
  { id: "accounting", label: "Accounting" },
  { id: "ai", label: "AI" },
];

export const INTEGRATION_CATALOG: IntegrationDefinition[] = [
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    description: "Accept card payments and let real transactions drive order state.",
    implementation: "credentials",
    capability:
      "Stores and validates your secret key against Stripe's account endpoint. Once connected, checkout can be switched from simulated to Stripe in Settings → Payments.",
    fields: [
      { key: "secretKey", label: "Secret key", placeholder: "sk_test_…", secret: true },
      { key: "publishableKey", label: "Publishable key", placeholder: "pk_test_…", optional: true },
      { key: "webhookSecret", label: "Webhook signing secret", placeholder: "whsec_…", secret: true, optional: true },
    ],
    envVar: "STRIPE_SECRET_KEY",
    docsUrl: "https://stripe.com/docs/api",
    mark: "S",
    accent: "#635bff",
  },
  {
    id: "paypal",
    name: "PayPal",
    category: "payments",
    description: "Offer PayPal and Venmo as an additional checkout method.",
    implementation: "planned",
    capability: "Connector slot only. No PayPal API calls are implemented yet.",
    fields: [
      { key: "clientId", label: "Client ID" },
      { key: "clientSecret", label: "Client secret", secret: true },
    ],
    mark: "P",
    accent: "#003087",
  },
  {
    id: "resend",
    name: "Resend",
    category: "email",
    description: "Deliver campaign and transactional email.",
    implementation: "live",
    capability:
      "Validates your API key and sends real campaign email. Campaigns can only leave draft once this is connected.",
    fields: [
      { key: "apiKey", label: "API key", placeholder: "re_…", secret: true },
      { key: "fromEmail", label: "From address", placeholder: "hello@yourstore.com" },
    ],
    envVar: "RESEND_API_KEY",
    docsUrl: "https://resend.com/docs",
    mark: "R",
    accent: "#111827",
  },
  {
    id: "klaviyo",
    name: "Klaviyo",
    category: "email",
    description: "Sync customers and subscribers into Klaviyo flows.",
    implementation: "planned",
    capability: "Connector slot only. No Klaviyo API calls are implemented yet.",
    fields: [{ key: "apiKey", label: "Private API key", secret: true }],
    mark: "K",
    accent: "#232426",
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    category: "email",
    description: "Push subscribers to a Mailchimp audience.",
    implementation: "planned",
    capability: "Connector slot only. No Mailchimp API calls are implemented yet.",
    fields: [
      { key: "apiKey", label: "API key", secret: true },
      { key: "audienceId", label: "Audience ID" },
    ],
    mark: "M",
    accent: "#ffe01b",
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    category: "email",
    description: "Alternative transactional and campaign delivery.",
    implementation: "planned",
    capability: "Connector slot only. No SendGrid API calls are implemented yet.",
    fields: [{ key: "apiKey", label: "API key", secret: true }],
    mark: "SG",
    accent: "#1a82e2",
  },
  {
    id: "google_analytics",
    name: "Google Analytics 4",
    category: "analytics",
    description: "Send storefront events to a GA4 property alongside Halyard analytics.",
    implementation: "credentials",
    capability:
      "Stores your measurement ID. The storefront will include the GA4 tag; no data is read back into Halyard dashboards.",
    fields: [
      { key: "measurementId", label: "Measurement ID", placeholder: "G-XXXXXXX" },
      { key: "apiSecret", label: "Measurement Protocol API secret", secret: true, optional: true },
    ],
    mark: "GA",
    accent: "#e37400",
  },
  {
    id: "google_ads",
    name: "Google Ads",
    category: "advertising",
    description: "Attribute paid search traffic and report conversions.",
    implementation: "planned",
    capability: "Connector slot only. No Google Ads API calls are implemented yet.",
    fields: [{ key: "customerId", label: "Customer ID", placeholder: "123-456-7890" }],
    mark: "Ads",
    accent: "#4285f4",
  },
  {
    id: "meta",
    name: "Meta (Facebook & Instagram)",
    category: "advertising",
    description: "Pixel tracking and catalog sync for Facebook and Instagram.",
    implementation: "planned",
    capability: "Connector slot only. No Meta Graph API calls are implemented yet.",
    fields: [
      { key: "pixelId", label: "Pixel ID" },
      { key: "accessToken", label: "Access token", secret: true, optional: true },
    ],
    mark: "M",
    accent: "#0866ff",
  },
  {
    id: "tiktok",
    name: "TikTok",
    category: "social",
    description: "TikTok pixel and product catalog feed.",
    implementation: "planned",
    capability: "Connector slot only. No TikTok API calls are implemented yet.",
    fields: [{ key: "pixelId", label: "Pixel ID" }],
    mark: "TT",
    accent: "#000000",
  },
  {
    id: "shippo",
    name: "Shippo",
    category: "fulfillment",
    description: "Buy labels and sync tracking numbers back onto orders.",
    implementation: "planned",
    capability: "Connector slot only. No Shippo API calls are implemented yet.",
    fields: [{ key: "apiToken", label: "API token", secret: true }],
    mark: "SH",
    accent: "#12b886",
  },
  {
    id: "easypost",
    name: "EasyPost",
    category: "fulfillment",
    description: "Multi-carrier shipping rates and label purchase.",
    implementation: "planned",
    capability: "Connector slot only. No EasyPost API calls are implemented yet.",
    fields: [{ key: "apiKey", label: "API key", secret: true }],
    mark: "EP",
    accent: "#164dff",
  },
  {
    id: "printful",
    name: "Printful",
    category: "fulfillment",
    description: "Print-on-demand production and fulfillment.",
    implementation: "planned",
    capability: "Connector slot only. No Printful API calls are implemented yet.",
    fields: [{ key: "apiKey", label: "API key", secret: true }],
    mark: "PF",
    accent: "#0d1a26",
  },
  {
    id: "printify",
    name: "Printify",
    category: "fulfillment",
    description: "Alternative print-on-demand network.",
    implementation: "planned",
    capability: "Connector slot only. No Printify API calls are implemented yet.",
    fields: [{ key: "apiKey", label: "API key", secret: true }],
    mark: "PY",
    accent: "#39b54a",
  },
  {
    id: "judgeme",
    name: "Judge.me",
    category: "reviews",
    description: "Import reviews collected by an external review provider.",
    implementation: "planned",
    capability:
      "Connector slot only. Halyard's built-in review system works today; this would import history from an external provider.",
    fields: [{ key: "apiToken", label: "API token", secret: true }],
    mark: "JM",
    accent: "#ff6b35",
  },
  {
    id: "zapier",
    name: "Zapier",
    category: "automation",
    description: "Trigger Zaps from store events via webhook.",
    implementation: "credentials",
    capability:
      "Stores a catch-hook URL. Order-created events are POSTed to it when the connector is active.",
    fields: [
      { key: "webhookUrl", label: "Catch hook URL", placeholder: "https://hooks.zapier.com/hooks/catch/…" },
    ],
    mark: "Z",
    accent: "#ff4f00",
  },
  {
    id: "make",
    name: "Make",
    category: "automation",
    description: "Scenario automation driven by store webhooks.",
    implementation: "credentials",
    capability: "Stores a webhook URL. Order-created events are POSTed to it when the connector is active.",
    fields: [{ key: "webhookUrl", label: "Webhook URL" }],
    mark: "MK",
    accent: "#6d00cc",
  },
  {
    id: "slack",
    name: "Slack",
    category: "support",
    description: "Post new orders and alerts into a Slack channel.",
    implementation: "credentials",
    capability: "Stores an incoming webhook URL. Notifications are POSTed to it when the connector is active.",
    fields: [{ key: "webhookUrl", label: "Incoming webhook URL", secret: true }],
    mark: "SL",
    accent: "#4a154b",
  },
  {
    id: "discord",
    name: "Discord",
    category: "support",
    description: "Mirror store notifications into a Discord channel.",
    implementation: "credentials",
    capability: "Stores a webhook URL. Notifications are POSTed to it when the connector is active.",
    fields: [{ key: "webhookUrl", label: "Webhook URL", secret: true }],
    mark: "DC",
    accent: "#5865f2",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    category: "accounting",
    description: "Sync orders and refunds into accounting.",
    implementation: "planned",
    capability: "Connector slot only. No QuickBooks API calls are implemented yet.",
    fields: [{ key: "realmId", label: "Company (realm) ID" }],
    mark: "QB",
    accent: "#2ca01c",
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    category: "automation",
    description: "Export orders and product data into a spreadsheet.",
    implementation: "planned",
    capability: "Connector slot only. OAuth is not implemented yet — CSV export works today from each table.",
    fields: [{ key: "spreadsheetId", label: "Spreadsheet ID" }],
    mark: "GS",
    accent: "#0f9d58",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    category: "ai",
    description: "Powers the Halyard business assistant and AI content generation.",
    implementation: "live",
    capability:
      "Validates and stores your API key. The assistant, store builder and copy generation all run through it. Can also be supplied via the ANTHROPIC_API_KEY environment variable.",
    fields: [
      { key: "apiKey", label: "API key", placeholder: "sk-ant-…", secret: true },
      {
        key: "model",
        label: "Model",
        placeholder: "claude-sonnet-5",
        optional: true,
        help: "Leave blank to use the server default.",
      },
    ],
    envVar: "ANTHROPIC_API_KEY",
    docsUrl: "https://docs.anthropic.com",
    mark: "A",
    accent: "#d97757",
  },
  {
    id: "custom_domain",
    name: "Custom domain",
    category: "domains",
    description: "Serve the storefront from your own domain.",
    implementation: "planned",
    capability:
      "Records the domain you intend to use. DNS verification and certificate issuance are not implemented — the storefront is served from its Halyard path today.",
    fields: [{ key: "domain", label: "Domain", placeholder: "shop.yourbrand.com" }],
    mark: "DN",
    accent: "#57574f",
  },
];

export function getIntegration(id: string): IntegrationDefinition | undefined {
  return INTEGRATION_CATALOG.find((i) => i.id === id);
}

export const IMPLEMENTATION_LABELS: Record<IntegrationImplementation, string> = {
  live: "Fully wired",
  credentials: "Credentials only",
  planned: "Not configured",
};
