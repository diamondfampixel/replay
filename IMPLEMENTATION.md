# Halyard — implementation plan & progress

> Working document. Update the checkboxes as phases land so progress survives
> a lost context window.

**Product:** Halyard — an AI-first commerce operating system. One place to build
a storefront, run the catalog, fulfil orders, read analytics, run experiments,
send campaigns, connect tools, and hand work to an AI operator that uses the
same validated services the UI does.

## Ground rules

1. No fake buttons. Every control either works, opens a working interface, or is
   explicitly labelled as not configured.
2. No hardcoded metrics in components. Charts read the database.
3. Seeded data is flagged `isDemo` on every row and surfaced as "Demo data" in
   the UI. Demo numbers are never presented as real business performance.
4. The AI assistant executes real tool calls against real services with Zod
   validation, capability checks and an audit trail — never canned text.
5. Integrations declare their true implementation level (`live` /
   `credentials` / `planned`). No invented endpoints, no false "Connected".

## Architecture

- **Next.js 16 App Router**, React 19, TypeScript strict, Tailwind v4.
- **PostgreSQL + Prisma 7** (driver adapter `@prisma/adapter-pg`).
- **Multi-tenant** from the schema up: `User → Membership → Organization →
  Store → everything`. Every query is scoped by `storeId`.
- **Auth**: cookie sessions, scrypt password hashing, DB-backed session records,
  hashed tokens at rest.
- **Authorization**: capability model in `src/lib/permissions.ts`; roles map to
  capabilities; server actions and AI tools both assert capabilities.
- **Services** (`src/lib/services/*`): the single write path. Server actions,
  REST routes and AI tools all call the same functions.
- **AI** (`src/lib/ai/*`): Anthropic tool-calling loop over a registry of
  Zod-described tools with read / low / high risk classification.
- **Storefront** renders `Page → PageSection[]` JSON configuration. The AI and
  the visual editor both edit that data, never generated source code.

## Phases

- [x] **1 — Foundation.** Project, design system, schema, migrations, auth,
      tenancy, provisioning, deterministic demo seed.
- [x] **2 — Admin shell.** Sidebar navigation, top bar, notifications, global
      search, command bar, responsive layout.
- [x] **3 — Commerce core.** Products (+ variants, images), collections,
      categories, orders, customers, discounts.
- [x] **4 — Storefront.** Section renderer, shop, product, collection, cart,
      simulated checkout, search, content pages.
- [x] **5 — Analytics.** Event collection, daily rollups, dashboards.
- [x] **6 — A/B testing.** Experiments, variant assignment, results, winner.
- [x] **7 — AI assistant.** Tool registry, execution loop, confirmations,
      action log, undo.
- [x] **8 — AI store builder + visual page editor.**
- [x] **9 — Email, reviews, content, media.**
- [x] **10 — Integrations framework.**
- [x] **11 — Settings, permissions, audit log, notifications.**
- [x] **12 — Polish, responsive, tests, error handling, accessibility.**

## Conventions

- Money is `Decimal(10,2)` in Postgres; convert with `toNumber()` from
  `src/lib/money.ts` before arithmetic in JS.
- Server actions return `ActionResult<T>` (`src/lib/action-result.ts`) — never
  throw to the client.
- Demo rows carry `isDemo: true`. `<DemoTag />` marks them in the UI.
- Dates in analytics rollups are UTC midnight (`@db.Date`).
