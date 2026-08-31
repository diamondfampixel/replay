# Halyard

**An AI-first commerce operating system.** One place to build a storefront, run
a catalog, fulfil orders, read analytics, run experiments and send campaigns —
plus an assistant that operates all of it through the same validated services
your team uses.

Halyard is a working full-stack application, not a prototype. Every screen reads
and writes real database records; every chart is computed from the order and
event tables; the AI assistant executes real tool calls with schema validation,
permission checks, human confirmation on high-impact actions, and an audit trail.

---

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Demo data](#demo-data)
- [Running locally](#running-locally)
- [AI configuration](#ai-configuration)
- [Stripe configuration](#stripe-configuration)
- [Integrations](#integrations)
- [Testing](#testing)
- [Deployment](#deployment)
- [What is and is not implemented](#what-is-and-is-not-implemented)
- [Project layout](#project-layout)

---

## What it does

### Admin

| Area | What it does |
| --- | --- |
| **Overview** | Revenue, orders, visitors, conversion, AOV, units, refunds with period-over-period change across six range presets plus custom ranges. Revenue/orders/visitors charts, conversion funnel, top products, traffic sources, recent orders, active experiments, recent AI actions, store status. |
| **Products** | Server-paginated table with search across title/SKU/description/vendor, six filters, seven sorts, bulk status changes and delete. Editor covers pricing and margin, inventory, SEO, tags, collections, images, and a variant matrix generated from option axes with per-variant SKU, price override and stock. |
| **Collections** | Manual curation with drag ordering, or rule-based matching on tag, title, price, category, vendor and inventory, evaluated live against the catalog. |
| **Categories** | Hierarchical product classification, kept separate from collections. Cycle protection and safe deletion. |
| **Orders** | Filterable list; detail view with items, totals, timeline, address snapshots, payments and attribution. Fulfill, refund (full or partial), cancel and note — each writes real records and adjusts inventory and analytics. |
| **Customers** | List with lifetime value aggregates; profile with order history, reviews, addresses, tags and notes. |
| **Discounts** | Percentage, fixed amount, free shipping and buy-X-get-Y, with product/collection scoping, minimums, usage limits and scheduling. Checkout enforces every rule. |
| **Store** | Storefront preview, live/paused control, page list, header and footer navigation editor, brand summary. |
| **Store editor** | Visual section editor with drag-to-reorder, add/duplicate/hide/delete, per-type settings panels, live preview with desktop/mobile toggle, autosaved drafts, and explicit Publish. |
| **Content** | Standalone pages with write/preview tabs, SEO fields, navigation visibility. All HTML sanitised on save. |
| **Media** | Upload (drag-and-drop), search, pagination, alt text, URL copy, delete. Local disk or Supabase storage. |
| **Analytics** | Six tabs — overview, sales, products, customers, traffic, conversion — sharing one range control. |
| **A/B testing** | Experiment list with live results; creation form seeded from what is actually live; detail view with visitors, conversions, rate, uplift, revenue per visitor and a p-value. |
| **Emails** | Campaign block editor with live preview, audience selection with real recipient counts, subscriber management. |
| **Reviews** | Moderation queue with bulk publish/hide/delete and manual entry. |
| **Integrations** | 23 connectors across 12 categories, each stating its true implementation level. |
| **Activity** | Every AI action with its parameters, result and undo, plus the organization audit log. |
| **Settings** | General, brand, domain, payments, shipping, taxes, notifications, AI behaviour, team and roles, demo-data purge, personal profile. |
| **Assistant** | Streaming chat with live tool-call rows, inline confirmations, conversation history, and a side panel reachable from anywhere. |

### Storefront

Homepage built from configurable sections, shop with filters, collections,
product pages with variant selection and real reviews, cart (drawer and page)
with discount codes, checkout, order confirmation, search and content pages.
Mobile-first and responsive.

### The assistant

The assistant has **58 typed tools** (56 offered to the model; two are internal undo helpers) covering analytics, catalog, collections,
orders, customers, discounts, experiments, storefront sections, content pages,
reviews and settings. It reads real data and makes real changes:

> "How has my store done this week?" → calls analytics tools, answers with actual figures
>
> "Create a 20% discount for everything until Sunday" → asks for anything missing, then creates it
>
> "Change the homepage hero to focus on free shipping" → reads the page, patches the section, shows a confirmation first
>
> "Make three headline variants and test them" → generates variants, creates the experiment, configures traffic
>
> "Which A/B test is winning?" → reports the leader *and* whether the result is significant

---

## Architecture

```
                       ┌──────────────────────────┐
   Admin UI ──────────►│                          │
   (server actions)    │      Service layer       │
                       │  src/lib/services/*      │──► PostgreSQL (Prisma)
   AI tools ──────────►│                          │
   (tool registry)     │  Zod validation          │
                       │  Capability checks       │
   Storefront ────────►│  Audit logging           │
   (server actions)    └──────────────────────────┘
```

**One write path.** The admin UI, the storefront and the AI assistant all call
the same functions in `src/lib/services/`. There is no second implementation for
the AI, and the model never emits SQL — it calls validated functions.

**Multi-tenant from the schema up.** `User → Membership → Organization → Store →
everything`. Every query is scoped by `storeId`, which is what enforces
isolation; there is a test suite for it.

**Storefront pages are data.** A page is an ordered list of sections, each a
type plus a JSON config validated by a Zod schema. The renderer, the visual
editor and the AI all read and write exactly that shape — which is why the AI
can safely edit a live store without generating React source.

**Two analytics sources, on purpose.** Money and order counts come from the
`Order` table so anything created anywhere is reflected exactly. Traffic comes
from the `AnalyticsDaily` rollup, which the event ingest endpoint increments as
events arrive. Nothing is computed inside a React component.

**Draft and publish.** `PageSection` rows are what visitors see. Editing stages
a working copy on the page; publishing writes it onto the live rows.

### AI safety model

| Tier | Behaviour | Examples |
| --- | --- | --- |
| **read** | Runs immediately | analytics, product lookup, experiment results |
| **low** | Runs immediately, reports what changed | create a draft product, draft a campaign, add a collection |
| **high** | Stops and asks, showing the real scope | change prices, publish, delete, refund, send email, edit the live storefront |

Risk escalates **per call**, not just per tool: editing a draft product is
routine; repricing a live one is not. A confirmation shows concrete facts —
which products, old price → new price, how many recipients — before anything
runs. Every call is written to `AIAction` with its parameters, result and status,
and reversible operations capture an undo snapshot at execution time.

---

## Tech stack

- **Next.js 16** (App Router, React 19, Server Components and Actions)
- **TypeScript** in strict mode
- **Tailwind CSS v4** with a hand-built component layer on Radix primitives
- **PostgreSQL 16** via **Prisma 7** driver adapters (`@prisma/adapter-pg`)
- **Zod 4** for every input boundary
- **Anthropic SDK** for the assistant's tool-calling loop
- **Recharts** for charts
- **Vitest** for tests

Authentication is built in: cookie sessions, scrypt password hashing, DB-backed
session records with hashed tokens, and rate limiting on sensitive endpoints.

---

## Setup

**Requirements:** Node 20+, PostgreSQL 14+.

```bash
git clone <repo> && cd halyard
npm install

cp .env.example .env
# Set DATABASE_URL and AUTH_SECRET at minimum.

npm run db:migrate      # create the schema
npm run db:seed         # build the demo business
npm run dev             # http://localhost:3000
```

Sign in with **demo@halyard.app / demo1234**, or create your own account at
`/signup` and go through onboarding.

---

## Environment variables

Only the first two are required. Everything else degrades honestly: the feature
says it is not configured rather than pretending.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | **yes** | PostgreSQL connection string |
| `AUTH_SECRET` | **yes** | Signs session and reset tokens. `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | no | Public base URL |
| `ANTHROPIC_API_KEY` | no | Enables the assistant, store builder and variant generation |
| `ANTHROPIC_MODEL` | no | Defaults to `claude-sonnet-4-5` |
| `STRIPE_SECRET_KEY` | no | Live payments (see below) |
| `STRIPE_WEBHOOK_SECRET` | no | Stripe webhook signature verification |
| `RESEND_API_KEY` | no | Real campaign sending |
| `EMAIL_FROM` | no | Sender address for campaigns |
| `SUPABASE_URL` | no | Media storage; falls back to local disk |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Media storage credential |
| `SUPABASE_STORAGE_BUCKET` | no | Defaults to `media` |

Secrets can also be supplied per-store through **Integrations** in the UI, where
they are stored server-side and never sent to the browser. An environment
variable always takes precedence over a stored credential.

---

## Database

```bash
npm run db:migrate      # apply migrations in development
npm run db:deploy       # apply migrations in production
npm run db:generate     # regenerate the Prisma client
npm run db:studio       # browse the data
npm run db:reset        # drop, recreate and reseed
```

The schema has 40 models and 14 enums. Key relationships:

- `Organization` owns `Store`s; `Membership` joins `User`s to `Organization`s with a `Role`
- `Product` has `ProductImage`s, `ProductVariant`s, a `Category`, and many `Collection`s
- `Order` has `OrderItem`s, `Payment`s and `OrderEvent`s (the timeline)
- `Page` has `PageSection`s (live) plus `draftSections` (the working copy)
- `Experiment` has `ExperimentVariant`s and `ExperimentEvent`s
- `AnalyticsEvent` is the raw stream; `AnalyticsDaily` is the rollup dashboards read
- `AIAction` and `AuditLog` record everything the assistant and the team do

Owner and admin differ by a single capability (`billing:manage`), so the
owner role is protected separately from the capability matrix: only an owner
can grant the owner role, change an owner's role, or remove an owner, and
nobody can change their own role. Without those rules an admin holding
`team:manage` could promote themselves and then remove the real owner.

Indexes cover the access patterns that matter: `(storeId, createdAt)` on orders
and events, `(storeId, status)` on products and experiments, unique
`(storeId, slug)` on every addressable entity.

---

## Demo data

`npm run db:seed` builds **Northwind Supply Co.** — 27 products with variant
matrices, 6 collections, 10 categories, 68 customers, ~3,600 orders across 180
days, daily analytics rollups, ~130 reviews, 5 discounts, 4 experiments with
real event history, 4 campaigns and ~100 subscribers.

Three things matter about it:

1. **It is deterministic.** A fixed-seed PRNG generates it, so charts do not
   change between page loads.
2. **Every row carries `isDemo: true`.** That is what lets the interface label
   demo figures — and what makes **Settings → Data** able to purge them cleanly
   while leaving anything you created untouched.
3. **It is never presented as real performance.** Demo revenue, traffic and
   experiment results are generated for development, and the UI says so.

Product imagery is generated as local SVG files rather than hotlinked, so the
demo works offline.

---

## Running locally

```bash
npm run dev         # development server
npm run build       # production build (runs prisma generate first)
npm start           # production server
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest
```

---

## AI configuration

Set `ANTHROPIC_API_KEY`, or connect Anthropic under **Integrations** — the key
is validated against the models endpoint before it is stored.

Without a key, everything else works. The assistant page explains it is not
configured, the API returns `503` with a `AI_NOT_CONFIGURED` code, and store
generation falls back to a deterministic template with editable placeholder copy.

**Adding a tool.** Define it with `defineTool` in `src/lib/ai/tools/`, give it a
Zod schema, a required capability and a risk tier, and export it from the array.
`src/lib/ai/registry.ts` picks it up: schema conversion, role filtering,
validation, audit logging and the confirmation flow all come for free.

```ts
defineTool({
  name: "archive_product",
  description: "Archive a product so it leaves the storefront but keeps its history.",
  schema: z.object({ productId: z.string() }),
  risk: "high",
  capability: "catalog:write",
  async confirm(input, ctx) { /* what the operator sees */ },
  async execute(input, ctx) { /* call a service function */ },
});
```

---

## Stripe configuration

**Checkout runs in simulated mode by default.** It creates genuine order
records, decrements inventory, applies discounts, writes the timeline and feeds
analytics — it just does not move money, and it says so on the checkout page and
the order.

Connecting Stripe under **Integrations** validates the key against Stripe's
account endpoint and stores it. Charge creation and webhook handling are **not
implemented in this build**: selecting Stripe mode in Settings → Payments
refuses checkout with an explanation rather than silently taking a fake payment.

The architecture is ready for it — `Payment` records carry `provider` and
`providerRef`, order state transitions are already driven by a service function,
and refunds go through `refundOrder`.

---

## Integrations

Twenty-three connectors across payments, email, analytics, advertising, social,
fulfillment, reviews, automation, support, domains, accounting and AI. Each
declares an honest implementation level:

- **live** — the connector performs real API calls (Resend, Anthropic)
- **credentials** — credentials are validated and stored, but no data flows yet
  (Stripe, Google Analytics, Zapier, Make, Slack, Discord)
- **planned** — a slot only; **connecting is refused** rather than showing a
  green badge for something that does nothing

Credential validation happens before storage. A rejection is recorded as an
error state, never as connected. Only key *names* are ever sent to the browser.

> On the service shown in the reference material this project was inspired by:
> no connector was added for it. Its API and integration method could not be
> verified, and inventing endpoints would be worse than leaving it out.

---

## Testing

```bash
npm test
```

95 tests across 7 files, run against a real PostgreSQL database with each file
provisioning its own isolated organization:

| File | Covers |
| --- | --- |
| `products.test.ts` | Product CRUD, slug uniqueness, partial updates, variant matrices, bulk operations, role authorization, **tenant isolation** |
| `cart-checkout.test.ts` | Cart pricing, stock limits, line merging, discount evaluation (percentage, fixed, minimums, collection scoping, expiry, free shipping), order creation, sequential numbering, refunds, cancellation with stock restoration |
| `experiments.test.ts` | Deterministic bucketing, weight distribution, zero-weight exclusion, draft/paused experiments never served, per-session dedup, goal wiring, significance maths, winner application |
| `ai-tools.test.ts` | Registry shape, Anthropic schema generation, role filtering, argument validation, risk classification and escalation, confirm/cancel flow, audit logging, undo, tenant isolation |
| `ai-chat-loop.test.ts` | The full tool-calling loop with the SDK mocked: text streaming, tool execution, result feeding, confirmation halting, failure handling, transcript persistence, round limits |
| `pages.test.ts` | Draft isolation, publish semantics, discard, section validation, HTML sanitisation |
| `permissions.test.ts` | Capability matrix per role, AI tool-surface filtering, integration validation, secrets never leaving the server |
| `sessions.test.ts` | That a password change or reset revokes other sessions but not other users', and that used or expired reset tokens are refused |
| `team-roles.test.ts` | That an admin cannot promote themselves, grant the owner role, demote an owner, or remove one — and that owners still can |
| `categories.test.ts` | Tree nesting, cycle refusal, and that a category cannot be re-parented under, renamed in, or deleted from another store |
| `sanitize-vectors.test.ts` | The sanitiser against 28 known XSS vectors plus 10 legitimate cases that must survive |
| `connected-loop.test.ts` | The whole system in one flow: the assistant creates a product, publishes it through the confirmation gate, it joins a collection and appears on the storefront, a shopper buys it with an AI-created discount, stock moves, the purchase converts the experiment that shopper was in, and the figures land in analytics and customer history |

### Browser smoke test

```bash
npm run build && npm start &
npm run smoke                      # or: node scripts/smoke-purchase.mjs <baseUrl> <storeSlug>
```

Drives a real purchase through a real browser: product page, variant selection,
cart drawer, discount entry and checkout. Requires Playwright
(`npm i -D playwright && npx playwright install chromium`).

If Chromium is already on the machine — a CI image, a devcontainer — point the
script at it instead of downloading a second copy:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run smoke
```

---

## Deployment

Halyard runs anywhere Node 20 and PostgreSQL are available.

```bash
npm ci
npm run db:deploy
npm run build
npm start
```

Checklist:

- Set `AUTH_SECRET` to a real random value — sessions and reset tokens depend on it
- Point `DATABASE_URL` at managed PostgreSQL with connection pooling
- Set `NEXT_PUBLIC_APP_URL` to the public URL
- Configure media storage (`SUPABASE_*`); local disk does not survive a restart
  on ephemeral hosts
- The in-process rate limiter in `src/lib/rate-limit.ts` is per-instance —
  swap its store for Redis before running more than one node

---

## What is and is not implemented

Being straight about this is the point.

**Fully working:** authentication and sessions, multi-tenancy and isolation,
roles and capabilities, the whole catalog, orders and fulfillment, customers,
discounts and their checkout enforcement, storefront rendering, cart, simulated
checkout, analytics collection and dashboards, A/B testing end to end, the AI
assistant and its 40 tools, the visual store editor with draft/publish, campaign
authoring, review moderation, content pages, media upload, the integration
framework, settings, audit logging and demo-data purge.

**Verified how:** 180 automated tests against a real database, plus a browser
smoke test that completes a purchase end to end. The assistant's tool-calling
loop is covered with the Anthropic SDK mocked — the orchestration, risk gating,
confirmation flow and transcript persistence are all exercised, but the build
has not been run against the live Anthropic API, so model behaviour itself is
unverified.

**Deliberately not implemented, and labelled as such in the UI:**

| Area | Status |
| --- | --- |
| Stripe charges and webhooks | Credentials validate; checkout refuses Stripe mode rather than faking a payment |
| Tax calculation | One flat rate. No nexus, destination rates, product taxability or exemptions. Not suitable for filing — the UI says so |
| Shipping rates | Flat rate with a free-shipping threshold. No zones or carrier rates |
| Custom domains | No DNS verification or certificate issuance; no fake form |
| Email invitations | Team members must already have an account |
| Billing | Plans are placeholders; nothing is charged |
| Most connectors | Marked "planned"; connecting is refused |

---

## Project layout

```
prisma/
  schema.prisma          40 models, 14 enums
  seed.ts                demo business entry point
src/
  app/
    (marketing)/         home, features, pricing
    (auth)/              login, signup, password reset
    (admin)/admin/       the back office
    (storefront)/s/[storeSlug]/   the customer-facing store
    api/                 tracking, media, search, AI chat/confirm
    actions/             server actions, thin wrappers over services
  components/
    ui/                  primitives (button, card, table, dialog…)
    admin/               back-office components
    storefront/          shopper-facing components
  lib/
    services/            the single write path
    ai/                  config, registry, executor, tools, context
    storefront/          section schema, data loaders, experiments
    integrations/        connector catalog
    demo/                deterministic seed generator
tests/                   vitest suites
```

### Conventions

- Money is `DECIMAL(10,2)`; convert with `toNumber()` from `src/lib/money.ts`
  before arithmetic
- Server actions return `ActionResult<T>` and never throw to the client
- Services take a `ServiceContext` carrying tenant, actor and role
- Demo rows carry `isDemo: true` and render a `<DemoTag />`
- Analytics rollup dates are UTC midnight
