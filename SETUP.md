# Film-maker — Setup Guide

One-time bootstrap walkthrough for a new Film-maker environment. Run these
commands in order. Everything is designed so you can do local dev **before**
any Cloudflare resources exist — you only need real infrastructure when you're
ready to deploy.

---

## 1. Install dependencies

```bash
npm install
```

## 2. Secrets (local development)

```bash
cp .env.local.example .env.local
```

Then fill in the values:

### `BETTER_AUTH_SECRET`
Generate a 32-byte hex string:
```bash
npm run auth:secret
# or: openssl rand -hex 32
```
Paste the output as `BETTER_AUTH_SECRET`.

### `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID.
- Application type: **Web application**
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
  (add `https://film-maker.net/api/auth/callback/google` for production)

### `GMAIL_*` (magic-link sender)
Port the OAuth2 refresh-token pattern from `../anthropist/lib/email.ts`. The
flow is:
1. Same Google Cloud project as the OAuth client above.
2. Enable the **Gmail API** for the project.
3. Use an OAuth playground or your own script to obtain a refresh token for
   the sender account (`yasirdora@gmail.com` for dev, a Workspace address for prod).
4. Store `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`,
   `GMAIL_SENDER` in `.env.local`.

> **Note**: using a personal Gmail as sender is fine for development but
> hurts deliverability and branding in production. Switch to a Google
> Workspace address on `film-maker.net` before public launch.

### `GOOGLE_SERVICE_ACCOUNT_JSON`
Image, video, and Auteur chat all run on **Vertex AI** (Gemini API was
phased out as a v0 backend because GCP free trial credits don't apply
to it).

Setup:
1. Cloud Console → **APIs & Services → Library** → enable **Vertex AI API**.
2. **IAM & Admin → Service Accounts** → Create service account named
   `film-maker-vertex` (or similar).
3. Grant it the role **Vertex AI User** on the project.
4. Open the service account → **Keys → Add key → JSON**. A `.json` file
   downloads — paste its full contents (single line, including the curly
   braces) as the value of `GOOGLE_SERVICE_ACCOUNT_JSON` in `.env.local`.
5. Optionally set `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`
   (defaults: project from the service account JSON, `us-central1`).

### `STRIPE_*`
Stripe Dashboard → Developers → API keys. Use **test mode** keys for `.env.local`.
- `STRIPE_SECRET_KEY` = `sk_test_...`
- `STRIPE_PUBLISHABLE_KEY` = `pk_test_...`
- `STRIPE_WEBHOOK_SECRET` — generated after you set up the webhook endpoint
  (see step 6 below).

### `TURNSTILE_*`
Cloudflare Dashboard → Turnstile → Add site. Use the test keys
(`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`)
for local dev to always-pass the challenge.

### `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`
sentry.io → Create project → Next.js. Copy the DSN into both env vars.
Optional for dev but recommended day one.

## 3. Create the Cloudflare D1 database

```bash
npm run db:create
```

Output looks like:
```
✅ Successfully created DB 'film-maker-db' in region ENAM
Created your new D1 database.

{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "film-maker-db",
      "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
  ]
}
```

Copy the `database_id` into `wrangler.jsonc`, replacing
`REPLACE_AFTER_WRANGLER_D1_CREATE`.

## 4. Apply migrations (local)

```bash
npm run db:migrate:local
```

Creates the schema in a local SQLite file under `.wrangler/state/v3/d1/`.

To inspect:
```bash
npm run db:query:local "SELECT name FROM sqlite_master WHERE type='table'"
```

## 5. Point the `STORAGE` binding at the existing R2 bucket

The R2 bucket behind `storage.film-maker.net` already exists from the ConveX
project. Look it up:

```bash
npx wrangler r2 bucket list
```

Find the bucket name that's attached to `storage.film-maker.net` and paste it
into `wrangler.jsonc`, replacing `REPLACE_WITH_EXISTING_BUCKET_NAME`.

All Film-maker v0 objects are namespaced under the key prefix `film-maker/v1/`,
so they cannot collide with old ConveX objects in the same bucket.

## 6. Stripe webhook (local forwarding)

In a separate terminal:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI prints a webhook signing secret starting with `whsec_...`. Paste it
into `.env.local` as `STRIPE_WEBHOOK_SECRET`. The dev server will now receive
live webhook events from your Stripe test account.

## 7. Run the dev server

```bash
npm run dev
# → http://localhost:3000
```

Fast HMR, uses Next.js native dev server with the Cloudflare bindings shimmed
in-process. This is the main development workflow.

To run the full Workers preview (slower but mirrors production):

```bash
npm run preview
```

---

## Deployment (first time)

```bash
# 1. Authenticate
npx wrangler login

# 2. Push secrets to production (NEVER commit them, NEVER paste them in chat)
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GMAIL_CLIENT_ID
npx wrangler secret put GMAIL_CLIENT_SECRET
npx wrangler secret put GMAIL_REFRESH_TOKEN
npx wrangler secret put GMAIL_SENDER
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put SENTRY_DSN

# 3. Run production migrations
npm run db:migrate:remote

# 4. Deploy
npm run deploy
```

## Troubleshooting

### `Cloudflare context not found`
You're calling `getDb()` or `getR2()` outside of a Worker request handler.
These functions only work inside route handlers, server actions, middleware,
or server components that run in the Cloudflare Worker runtime. Not in
`getStaticProps` equivalents or at module load time.

### `npm install` fails with peer dependency errors
Check the error. If it's Next.js version mismatch on a Sentry/Better Auth
peer, bump the relevant package. Avoid `--legacy-peer-deps` unless you've
confirmed the upstream issue — it papers over real compatibility problems.

### D1 migration fails: `table X already exists`
Local D1 state lives under `.wrangler/state/v3/d1/`. To reset:
```bash
rm -rf .wrangler/state
npm run db:migrate:local
```
