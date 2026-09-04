# Deploying Halyard

The stack is Next.js 16 + PostgreSQL, so any host that runs both works. This
guide uses **Vercel** for the app and **Neon** for the database because both
have free tiers and the whole thing takes about ten minutes.

## 1. Database (Neon)

The Neon project already exists (`flat-fire-69428670`, branch `production`).
Neon gives two connection strings for it:

- the **pooled** string — host contains `-pooler` — for the running app;
- the **direct** string — no `-pooler` — for migrations only.

Both carry credentials: keep them in environment variables, never in git.
Any managed PostgreSQL 15+ works the same way — use the pooled URL at runtime
and the direct URL for `prisma migrate deploy` if the host offers both.

## 2. App (Vercel)

Either click the button in the README, or by hand:

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account.
2. **Add New → Project** and import `diamondfampixel/replay`, branch
   `claude/ai-ecommerce-platform-ge4e8c` (or the branch you merged it into).
3. Framework is auto-detected as Next.js; leave build settings alone. The
   repo defines a `vercel-build` script that runs `prisma migrate deploy`
   before `next build`, so every deploy applies pending migrations using the
   direct URL.
4. Add the environment variables:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Neon **pooled** string |
   | `DATABASE_URL_UNPOOLED` | the Neon **direct** string (migrations) |
   | `AUTH_SECRET` | output of `openssl rand -base64 32` |
   | `NEXT_PUBLIC_APP_URL` | your Vercel URL, e.g. `https://halyard.vercel.app` (you can set it after the first deploy) |
   | `LAUNCH_STAGE` | `waitlist` until you open sign-up |
   | `WAITLIST_INVITE_CODES` | comma-separated codes for invited testers |
   | `HALYARD_ANTHROPIC_KEY` | enables the AI assistant |
   | `ANTHROPIC_MODEL` | optional — defaults to `claude-sonnet-5` |

   Optional but strongly recommended before real users: `SUPABASE_*`
   (uploads), `RESEND_API_KEY` + `EMAIL_FROM` (password reset), `UPSTASH_*`
   (rate limits), `MONITORING_WEBHOOK_URL` (errors and AI alerts),
   `HALYARD_PLATFORM_ADMINS` (economics report). See `.env.example`.

5. Deploy. The build log shows `prisma migrate deploy` applying the
   migrations, then the Next.js build.

## 3. Migrate — and do not seed production

The Vercel build applies migrations automatically (step 2). To run them
yourself instead, from a machine that can reach Neon, with the **direct**
string:

```bash
DATABASE_URL="<neon direct url>" npx prisma migrate deploy
DATABASE_URL="<neon direct url>" npx prisma migrate status
```

**Do not run `npm run db:seed` against a production database.** The seed
creates the demo organization with the published development credentials
(`demo@halyard.app` / `demo1234`) — fine on a laptop, a publicly known login
on a live site. Create your own account through the app instead (with an
invite code while `LAUNCH_STAGE=waitlist`). If you want a populated store to
show people, seed a separate staging database.

## Serverless caveats

Two subsystems assume a single long-lived server and degrade on serverless:

- **Media uploads** default to local disk (`public/uploads`), which is
  read-only/ephemeral on Vercel. Set the `SUPABASE_*` variables from
  `.env.example` to store uploads in Supabase Storage instead. Seeded product
  artwork ships in the repo and is unaffected.
- **Rate limiting** (`src/lib/rate-limit.ts`) is in-process, so on serverless
  each warm instance counts separately. Acceptable for a demo; swap the store
  for Redis/Upstash before relying on it in production.

Everything else — sessions, checkout, A/B assignment, the AI tool loop, the
advisory locks on order numbering — is stateless per request or lives in
PostgreSQL, and works unchanged on serverless.
