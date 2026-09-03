# Halyard — project context

Durable orientation for engineers and future Claude Code sessions. Keep it current; keep it short; never put secret values here.

## What Halyard is

An AI-first ecommerce operating system: one place to build a storefront, manage products and orders, read analytics and run growth, with an assistant that does the work through structured tools. Multi-tenant (Organization → Store), Next.js App Router, PostgreSQL. Currently in the **pre-beta / waitlist** stage (`LAUNCH_STAGE`).

## Where the code lives

- Repository: `github.com/diamondfampixel/replay` (private), working branch `claude/ai-ecommerce-platform-ge4e8c` — the only branch with the product; there is no separate `main` line of development. Every Claude session commits and pushes here.
- The Claude Code cloud sandbox clones the repo fresh into `/home/user/replay`; it is ephemeral. **GitHub is the durable copy.**
- Deployment: no Vercel project, `vercel.json`, or `.vercel/` link exists in the repository as of 2026-09-03. Hosting has not been set up.

## Architecture map

| Area | Where |
|---|---|
| App Router pages | `src/app/(admin)/admin/**` (operator UI), `src/app/(storefront)/s/[storeSlug]/**` (public storefront), `src/app/(storefront)/preview-theme/**` (admin-only theme preview), `src/app/(marketing)/**` (waitlist + marketing site) |
| API routes | `src/app/api/**` — AI chat/confirm, billing checkout/portal/webhook, themes checkout, storefront cart/checkout, auth, waitlist |
| Server actions | `src/app/actions/*.ts` |
| Services (business logic, authorization, audit) | `src/lib/services/*.ts` — `context.ts` (ServiceContext, `authorize`, `audit`), `pages.ts` (draft/publish), `snapshots.ts`, `themes.ts`, `billing.ts`, `cart.ts`, `orders.ts`, … |
| Database | Prisma 7 + PostgreSQL: `prisma/schema.prisma`, migrations in `prisma/migrations`; client generated to `src/generated/prisma` |
| Auth & permissions | `src/lib/session.ts` (cookie `halyard_session`, hashed tokens), `src/lib/permissions.ts` (roles → capabilities such as `storefront:write`, `billing:manage`, `ai:use`) |
| Plans & billing | `src/lib/plans.ts` (Harbor free · Skiff · Clipper · Flagship, limits incl. AI actions and design snapshots), `src/lib/stripe.ts`, `src/app/api/billing/*`, `src/lib/services/billing.ts` (AI metering, plan checks) |
| AI | `src/lib/ai/` — `config.ts` (key resolution), `client.ts`, `context.ts` (system prompt), `registry.ts`, `executor.ts` (confirm/undo), `conversation.ts`, `store-builder.ts`, `tools/*.ts` (read, catalog, marketing, storefront, design, operations) |
| Storefront design system | `src/lib/storefront/` — `dna.ts` (Design DNA), `theme.ts` (tokens, directions, `resolveTheme`), `sections.ts` (25 section types, compositions, `design` overrides), `section-fields.ts` (editor + AI field specs), `compose.ts` (deterministic composition engine + recipes), `themes.ts` (theme library), `custom-css.ts` (scoped sanitiser), `font-licenses.ts` |
| Storefront rendering | `src/components/storefront/` — `frame.tsx`, `header.tsx`, `footer.tsx`, `section-shell.tsx`, `sections/*`, `product-detail.tsx`, `motion.tsx`, `media.tsx`, `preview-bridge.tsx`; CSS tokens/rules in `src/app/globals.css` (`.st-*`) |
| Editor & design UI | `src/components/admin/store-editor.tsx`, `section-settings.tsx`, `design-settings-form.tsx`, `theme-gallery.tsx` |
| Demo data | `src/lib/demo/*`, `prisma/seed.ts`, `scripts/make-builder-stores.mjs` |
| Tests | `tests/*.test.ts` (vitest; needs a running PostgreSQL and `DATABASE_URL`) |
| Docs | `docs/fonts/FONT_LICENSES.md` (font manifest + license texts), this file |

## Core product rules (decided)

- **Pricing (keep):** Free/Harbor $0 · Skiff $19/mo ($15 annual) · Clipper $49/mo ($39 annual) · Flagship $129/mo ($99 annual). AI actions: Free 50 one-time; paid plans monthly allowances in `plans.ts`.
- **Design snapshots:** rolling count per plan — Free 5, Skiff 20, Clipper 50, Flagship 100; automatic snapshot before AI redesigns, theme applies and restores; automatic/AI snapshots recycle before manual ones.
- **Custom CSS:** available on every plan including Free; scoped to `.st-root`, sanitised (no `@import`, `url()`, expressions, scripts, unbalanced braces), reset button.
- **Themes:** 20 included (free on every plan) + 7 premium. Premium prices: Standard $5 · Premium $10 · High-end $15 one-time. Purchases via Stripe Checkout (payment mode) recorded only by the signed webhook; ownership recorded per organization (owner decision pending); apply always snapshots first. First-party themes only; no marketplace.
- **Fonts:** Google Fonts only, every family verified OFL 1.1 (`docs/fonts`). No self-hosting, no commercial fonts, no merchant uploads for now.
- **AI honesty:** never invent data, testimonials, reviews or facts; write tools that touch the live store confirm first; broad design changes snapshot first and expose restore as undo. Live model calls use the store/deployment key; nothing is faked when no key exists.
- **Waitlist:** the one-screen waitlist at `/` during `LAUNCH_STAGE=waitlist` is final — do not redesign it.

## Environment variables (names only)

`DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `LAUNCH_STAGE` (waitlist | early-access | public), `WAITLIST_INVITE_CODES`, `ANTHROPIC_API_KEY` or `HALYARD_ANTHROPIC_KEY` (deployment-wide AI key; a store may instead connect its own key under Integrations), `ANTHROPIC_MODEL` (default `claude-sonnet-5`), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SOCIAL_*`, `NEXT_PUBLIC_CONTACT_EMAIL`. Values live only in the deployment/secret store.

## Running it

```
service postgresql start          # sandbox
npx prisma migrate deploy && npx prisma generate
npm run dev                       # or: npm run build && npx next start -p 3250
npx vitest run                    # ~300 tests
npx tsc --noEmit && npm run lint
npx tsx scripts/dev-session.ts <email>   # mints a session token for local testing
set -a; . ./.env; set +a; npx tsx scripts/make-builder-stores.mjs   # six demo stores
```

Demo accounts (development databases only): `demo@halyard.app` (Northwind Supply Co., large demo dataset), `owner-<slug>@halyard-demo.dev` / `builder-demo-2026!` for voidwear, fizzpop, maison-eau, gridlock, fieldnote, nova-vale.

## Status and blockers (2026-09-03)

- Storefront Builder 2.0, theme library, snapshots, font manifest: built and tested.
- Live Anthropic verification: performed with a funded key (see the phase report); the assistant, design tools and confirmations run end to end.
- Not set up: hosting/Vercel, Stripe live keys, custom domains, email delivery provider for production.
- Owner decisions pending: theme ownership scope (per organization vs per store), theme refund policy, Stripe live-mode activation, font licensing scope beyond Google Fonts, hosting provider/account.

## Post-beta backlog (design/themes)

Third-party theme marketplace (creator payouts, tax, contracts, moderation, refunds), theme reviews once real customers exist, larger premium library, merchant-uploaded fonts with licensing attestations, additional font providers after legal review, section-based templates for product/collection pages, nested blocks, mega menu, reference-site visual analysis, advanced generated components.
