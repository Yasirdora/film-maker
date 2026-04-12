# Film-maker

AI-powered filmmaking, simplified. A simpler alternative to Google Flow, built on Cloudflare.

**Stack**: Next.js 16 · React 19 · TypeScript · OpenNext · Cloudflare Workers · Cloudflare D1 · Cloudflare R2 · Better Auth · Stripe · Google Gemini (Nano Banana Pro)

> **Status**: v0 in active development — image generation only. Veo 3.1 video generation lands in v1.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy local env template and fill in the secrets
cp .dev.vars.example .dev.vars
# then edit .dev.vars

# 3. Create the D1 database (once per environment)
npm run db:create
# paste the returned database_id into wrangler.jsonc

# 4. Apply migrations locally
npm run db:migrate:local

# 5. Run the dev server (Next.js native, fast HMR)
npm run dev
# → http://localhost:3000

# 6. Or run the full Workers preview (slower, but mirrors production)
npm run preview
```

See [`SETUP.md`](./SETUP.md) for the full bootstrap walkthrough including
Cloudflare account setup, Stripe products, Google OAuth, Gmail sender, and
custom-domain wiring.

## Project layout

```
app/                   # Next.js App Router
  (auth)/              # Auth routes (login, magic-link verify)        — Phase 2
  api/                 # Route handlers (auth, stripe, generate, ...)  — Phase 2+
  auteur/              # Main creator workspace (mobile-first editor)  — Phase 5
  credits/             # Buy credits, transaction history              — Phase 3
  dashboard/           # Project list, home after login                — Phase 5
  payments/            # Stripe checkout return, payment history       — Phase 3
  pricing/             # Public pricing page                           — Phase 3
  project/             # Individual project view                       — Phase 5
  settings/            # Account settings, billing portal              — Phase 5
  welcome/             # Post-signup onboarding                        — Phase 5
  layout.tsx           # Root layout (viewport, fonts, metadata)
  page.tsx             # Landing (placeholder in Phase 1)
  globals.css          # Tailwind v4 + design tokens
components/            # Shared UI primitives (shadcn-style)           — Phase 5
hooks/                 # Client React hooks                            — Phase 5
lib/
  db.ts                # D1 + R2 binding accessor (for Next.js on Workers)
  constants.ts         # Plans, models, prices, cost calc — single source of truth
  auth.ts              # Better Auth config                            — Phase 2
  email.ts             # Gmail REST API sender (port from anthropist)  — Phase 2
  gemini.ts            # Nano Banana Pro client                        — Phase 4
  credits.ts           # Two-pool credit deduction, atomic             — Phase 4
  stripe.ts            # Stripe client + helpers                       — Phase 3
migrations/
  0001_init.sql        # Better Auth tables + app tables + infra tables
middleware.ts          # Auth gate for protected routes                — Phase 2
wrangler.jsonc         # Cloudflare Workers config
open-next.config.ts    # OpenNext config (minimal)
```

## Architecture decisions

- **No ORM for app code** — raw D1 SQL with parameterized queries and numbered
  SQL migrations (anthropist-style). Drizzle is present only because Better Auth
  requires it for its D1 adapter, scoped to auth tables.
- **No background queue for v0** — Nano Banana Pro returns in seconds, so image
  generation is a synchronous API call. Cloudflare Queues + a consumer Worker
  land alongside Veo 3.1 in v1.
- **Single domain, single Next.js app** — marketing, auth, dashboard, and editor
  all live on `film-maker.net`. No subdomain split. Storage is on
  `storage.film-maker.net` (the R2 bucket).
- **Mobile-first from day one** — single responsive component tree, two layouts
  driven off viewport for the Auteur editor. Full feature parity on mobile.
- **Atomic credit deduction** — the two-pool credit model (subscription +
  purchased) is deducted via a single `UPDATE` statement. No multi-statement
  transactions needed.
- **Idempotent Stripe webhooks** — `credit_transaction.stripe_session_id` is
  `UNIQUE`, so retried webhooks become no-ops.

## Credit model

Ported from the ConveX experiment, simplified for v0.

| Plan    | Price   | Credits/mo | Daily cap | Max resolution |
| ------- | ------- | ---------- | --------- | -------------- |
| Solo    | Free    | 100        | 3 / day   | 1K             |
| Indie   | $20 /mo | 200        | —         | 2K             |
| Creator | $50 /mo | 500        | —         | 4K             |
| Studio  | $200/mo | 2,000      | —         | 4K             |

**Cost formula**: `credit_base × resolution_multiplier × sample_count`
Resolution multipliers: 1K=1×, 2K=2×, 4K=4×.

## Reference projects

Two sibling projects under `../` inform Film-maker's design — read them before
touching related code:

- **`../anthropist/`** — working Next.js 16 + OpenNext + D1 site. Port auth
  patterns, D1 binding shim, Gmail email sender, and SQL migration style.
- **`../ConveX/`** — earlier Flow prototype built on Convex (BaaS), abandoned
  over cost. Port credit model, pricing plans, Stripe fulfillment logic,
  directory layout, and UI/UX patterns. **Never port Convex runtime calls.**

## Contributing

Commit messages: imperative mood, under 72 characters, explain WHY.
Don't commit `.dev.vars`, `.env*`, or anything under `.wrangler/` or `.open-next/`.

## License

Proprietary. © Film-maker.
