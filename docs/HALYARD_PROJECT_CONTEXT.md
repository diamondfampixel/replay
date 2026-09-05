# Halyard — project context

Durable orientation for anyone (human or AI) picking this project up. No secrets here — only names of environment variables. Updated 5 September 2026.

## What Halyard is

An AI-first ecommerce operating system: one place to build a storefront, manage products and orders, read analytics and run growth, with an assistant that does the work through structured, permission-checked tools. Multi-tenant (Organization → Store), Next.js 16 App Router, PostgreSQL via Prisma. Currently in the **pre-beta / waitlist** stage.

## Where the code lives

- GitHub `diamondfampixel/replay`, branch `claude/ai-ecommerce-platform-ge4e8c` (the only development branch; merge it into `main` when ready).
- Vercel project **halyard** deploys from that branch (owner's account). Production database: Neon project `flat-fire-69428670`, branch `production`.
- The Claude Code sandbox is a throwaway workbench; anything not pushed is lost.

## Architecture map

| Area | Where |
|---|---|
| App pages | `src/app` — admin under `(admin)/admin`, storefront under `(storefront)/s/[storeSlug]`, marketing/waitlist under `(marketing)`, auth under `(auth)` |
| Server actions | `src/app/actions/*.ts` (every action resolves a `ServiceContext` and calls `authorize`) |
| API routes | `src/app/api/*` (cookie-authenticated POST routes call `rejectCrossOrigin`) |
| Services (all tenant-scoped by `storeId`/`organizationId`) | `src/lib/services/*.ts` |
| Data model | `prisma/schema.prisma`, migrations in `prisma/migrations` |
| Storefront design system | `src/lib/storefront` (theme tokens, Design DNA, sections + fields, compose engine, themes catalogue, premium gating), renderers in `src/components/storefront` |
| AI | `src/lib/ai` (registry, executor with confirmation gates, tools, routing by tier, pricing, context/caching); routes `src/app/api/ai/*` |
| Billing & plans | `src/lib/plans.ts`, `src/lib/stripe.ts`, `src/app/api/billing/*`, `src/lib/services/billing.ts` (allowances, spend ceilings, ledger), `src/lib/services/economics.ts` |
| Custom domains | `src/lib/domains/*` (validation, Vercel client), `src/lib/services/domains.ts`, `src/middleware.ts` (host routing), `/api/domains/resolve` |
| Media | `src/lib/services/media.ts` (Supabase Storage or Vercel Blob; local disk in development only) |
| Integrations | `src/lib/integrations/catalog.ts` (honest statuses), `src/lib/services/integrations.ts`, sourcing adapters in `src/lib/sourcing` |
| Launch gating | `src/lib/launch.ts` (`LAUNCH_STAGE`), waitlist in `src/components/marketing/waitlist-*.tsx` |
| Tests | `tests/*.test.ts` (vitest; needs PostgreSQL and `DATABASE_URL`) |
| Docs | `DEPLOY.md`, `docs/fonts/FONT_LICENSES.md`, this file |

## Decided product rules

- **Pricing (keep):** Free $0 · Skiff $19/mo ($15 annual) · Clipper $49/mo ($39 annual) · Flagship $129/mo ($99 annual). One-time premium themes $5 / $10 / $15. No overage billing; the assistant pauses at the allowance with an upgrade message.
- **AI allowances:** Free 25 actions lifetime (never refills); Skiff 100, Clipper 250, Flagship 600 per month. One message = one action however many tools run internally; confirming/cancelling/undoing costs nothing; onboarding "generate with AI" counts as one action.
- **AI spend safeguards (internal, never shown as dollars):** per-plan estimated-spend ceilings $2.50 / $10 / $25 / $60; per-request ceiling $0.60; loop/repeat detection; call timeout and request deadline; org-wide rate limit; optional platform daily brake; alerts at 80%/100%. Model routing: read-only questions on Haiku 4.5, changes on Sonnet 5 medium effort, design on Sonnet 5 high effort; only escalates.
- **Launch stage:** `LAUNCH_STAGE` unset or `waitlist` shows the waitlist at `/` and gates signup behind `WAITLIST_INVITE_CODES`; `public` must be set explicitly to open signup. Joining the waitlist never needs a code. Storefront routes and login are unaffected.
- **Media:** production refuses uploads unless Supabase Storage or Vercel Blob is configured (clear message, Media page banner). Raster images only, validated by bytes; SVG is not accepted.
- **Themes:** 20 included (free on every plan) + 7 premium. Premium themes use premium-only sections (lookbook, spec sheet, drop countdown) and the editorial product layout, which included themes cannot reach; the editor and AI tools enforce this by entitlement (any paid theme purchase, or a premium active theme). Applying a theme always snapshots first. Ownership is per organization (owner decision pending); refunds reverse entitlement on `charge.refunded`.
- **Design snapshots:** Free 5, Skiff 20, Clipper 50, Flagship 100.
- **Custom CSS:** every plan, scoped to `.st-root`, sanitised (no imports, urls, scripts; comments stripped before brace balancing).
- **Fonts:** Google Fonts only, all 24 families verified OFL 1.1 (`docs/fonts`). No third-party provider logos are shipped anywhere; integrations use text names and neutral monograms.
- **Taxes:** merchant checkout applies a single flat rate that the UI describes honestly (not a calculation; no registration, filing or remittance). Halyard's own sales can use Stripe Tax via `STRIPE_TAX_ENABLED` once the Stripe account has an origin address and registrations. No homegrown tax engine.
- **Integrations:** cards show Available / Coming soon / Connected. Providers needing Halyard's own developer app (AliExpress, PayPal, Google Ads/Sheets, TikTok, QuickBooks, Shippo) are internally "HALYARD PROVIDER SETUP REQUIRED". CJdropshipping, webhooks (Slack/Discord/Zapier/Make), Resend, GA4 and Anthropic work with merchant-supplied details. Shopper checkout through a merchant's own Stripe is not switched on yet (simulated mode, labelled).
- **Waitlist:** the one-screen waitlist at `/` is final — do not redesign it.
- **AI honesty:** never invent data or reviews; write tools confirm first; broad design changes snapshot first.

## Environment variables (names only)

Required: `DATABASE_URL` (pooled on serverless), `DATABASE_URL_UNPOOLED` (migrations), `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `LAUNCH_STAGE`, `WAITLIST_INVITE_CODES`, one of `SUPABASE_URL`+`SUPABASE_SERVICE_ROLE_KEY`(+`SUPABASE_STORAGE_BUCKET`) or `BLOB_READ_WRITE_TOKEN`, `HALYARD_ANTHROPIC_KEY` (or `ANTHROPIC_API_KEY`), `RESEND_API_KEY`+`EMAIL_FROM`, `MONITORING_WEBHOOK_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`.
Recommended: `UPSTASH_REDIS_REST_URL`+`UPSTASH_REDIS_REST_TOKEN`, `HALYARD_PLATFORM_ADMINS`, `VERCEL_API_TOKEN`+`VERCEL_PROJECT_ID`(+`VERCEL_TEAM_ID`), `HALYARD_PLATFORM_HOSTS`.
Billing: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_TAX_ENABLED`.
AI tuning: `ANTHROPIC_MODEL`, `AI_LIGHT_MODEL`, `AI_REQUEST_SPEND_CEILING_USD`, `AI_PLATFORM_DAILY_SPEND_CEILING_USD`.
Values live only in the deployment's environment settings. See `.env.example`.

## Running it

```
npm install
npx prisma migrate deploy && npx prisma generate
npm run dev            # http://localhost:3000
npm test               # vitest, needs DATABASE_URL
npm run build          # production build (vercel-build also runs migrate deploy)
```

Demo accounts exist only in seeded development databases (`prisma/seed.ts`, `scripts/make-builder-stores.mjs`). Never seed production.

## Status and blockers (2026-09-05)

Done in code: waitlist-safe launch default, durable media storage with byte validation, custom domains (reserve mode without hosting credentials), AI economics and safeguards, premium theme differentiation, security fixes (tenant scoping, authorisation, CSRF guard, SSRF allow-list, order confirmation keys, custom CSS containment), webhook idempotency, Stripe Tax flag, honest integration statuses.

Needs production configuration: durable storage, Resend, Upstash, monitoring webhook, platform admins, Vercel domains token, Stripe (test then live), Stripe Tax.

Owner decisions pending: theme ownership scope and refund policy, unverified-email policy, Stripe live activation, tax registrations and filing (professional advice), Vercel plan (Pro required for commercial use), Neon plan for longer restore windows, legal review of Terms/Privacy/Refunds, support inbox and domain.

## Post-beta backlog

Shopper checkout through the merchant's own Stripe account (Connect) with Stripe Tax; OAuth "Connect" flows for Klaviyo, Mailchimp, Printful, Printify, Judge.me, Slack; automatic www/apex redirects and root-relative storefront links on custom domains; SVG sanitiser; strict script CSP; `next/image` on storefronts; waitlist admin UI and invite emails; data-retention purge for events/transcripts; third-party theme marketplace; merchant fonts.
