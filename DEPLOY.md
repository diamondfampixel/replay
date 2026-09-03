# Deploying Halyard

The stack is Next.js 16 + PostgreSQL, so any host that runs both works. This
guide uses **Vercel** for the app and **Neon** for the database because both
have free tiers and the whole thing takes about ten minutes.

## 1. Database (Neon)

1. Sign up at [neon.tech](https://neon.tech) and create a project.
2. Copy the connection string it shows you (the pooled one, ending in
   `?sslmode=require`).
3. That string is your `DATABASE_URL`.

Any managed PostgreSQL 15+ works the same way — Vercel Postgres, Supabase,
Railway, RDS. Use the pooled/connection-pooler URL if the host offers one.

## 2. App (Vercel)

Either click the button in the README, or by hand:

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account.
2. **Add New → Project** and import `diamondfampixel/replay`.
3. Framework is auto-detected as Next.js; leave build settings alone —
   `npm run build` already runs `prisma generate`.
4. Add the environment variables:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Neon string from step 1 |
   | `AUTH_SECRET` | output of `openssl rand -base64 32` |
   | `NEXT_PUBLIC_APP_URL` | your Vercel URL, e.g. `https://halyard.vercel.app` (you can set it after the first deploy) |
   | `ANTHROPIC_API_KEY` | optional — enables the AI assistant |
   | `ANTHROPIC_MODEL` | optional — defaults to `claude-opus-5` |

5. Deploy.

## 3. Migrate — and do not seed production

From your machine, with the production `DATABASE_URL`:

```bash
DATABASE_URL="<neon url>" npx prisma migrate deploy
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
