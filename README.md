# Once Upon A You — v2

Personalised children's books. Clean rebuild on **React/Vite + Netlify
Functions + Supabase + Replicate (FLUX Kontext Pro) + Anthropic + Stripe +
Resend + BookVault**. No code from the old HTML/Vercel build is reused.

---

## Architecture

```
Customer → order form (React) → /api/save-order → Supabase (ouay_orders) → Stripe Payment Link
Stripe → /api/stripe-webhook → mark paid, emails, trigger story generation
        → /api/generate-story (background) → Claude story + sense check → character reference → queue 22 image jobs/story
Supabase pg_cron (60s) → ouay-process-image-queue edge function → Replicate → images → order 'images_complete'
Admin (/admin) → review images → Approve → assemble PDFs → BookVault (print) and/or ebook email → Dispatch
```

- **Frontend**: `src/` (Vite SPA). Pages: home `/`, order `/order`, success
  `/success`, admin `/admin`, privacy `/privacy`.
- **Server logic**: `netlify/functions/*.js` (ESM). Shared code in
  `netlify/functions/_shared/`.
- **Image queue**: `supabase/functions/ouay-process-image-queue/` (Deno edge
  function, run by pg_cron).
- **Single source of truth for products**: `src/lib/products.js` — imported by
  both frontend and functions.

Long-running work uses Netlify **background functions** (filenames ending
`-background`, up to 15 min): `generate-story-background`,
`admin-approve-background`. `netlify.toml` aliases `/api/generate-story` and
`/api/admin-approve` to them.

---

## Deploy

### 1. Supabase migrations (run in the SQL editor — NOT the CLI)

This project (`<your-project-ref>`) has known `schema_migrations` history
drift, so `supabase db push` is unreliable. Paste-and-run each file, in order,
in the Supabase SQL editor:

1. `supabase/migrations/01_ouay_orders.sql`
2. `supabase/migrations/02_ouay_stories.sql`
3. `supabase/migrations/03_ouay_image_jobs.sql`
4. `supabase/migrations/04_ouay_storage_buckets.sql`
5. `supabase/migrations/05_ouay_image_queue_cron.sql` — **replace
   `<<SERVICE_ROLE_KEY>>` first** (see the file header), and deploy the edge
   function (step 2) before running it.

### 2. Image-queue edge function

```
supabase functions deploy ouay-process-image-queue \
  --project-ref <your-project-ref> --no-verify-jwt
supabase secrets set REPLICATE_API_TOKEN=... --project-ref <your-project-ref>
```

### 3. Netlify

- Connect this repo; build command `npm run build`, publish dir `dist`
  (already in `netlify.toml`).
- Add every env var from `.env.example` in Netlify → Site settings →
  Environment variables.
- Point the site's custom domain to `onceuponayou.co.uk`.

### 4. Stripe

- In each Payment Link's settings, set the **success URL** to
  `https://onceuponayou.co.uk/success`.
- Add a webhook endpoint → `https://onceuponayou.co.uk/api/stripe-webhook`,
  event `checkout.session.completed`. Put its signing secret in
  `STRIPE_WEBHOOK_SECRET`.
- The order form appends `?client_reference_id=OAY-xxx` to the Payment Link so
  the webhook can match the checkout back to the order.

---

## ⚠️ Confirm before launch

These are deliberately flagged rather than silently guessed:

- **Story model id.** The brief specified `claude-sonnet-4-6`; it's the single
  `STORY_MODEL` constant in `netlify/functions/_shared/story.js`. If Anthropic
  returns model-not-found, update that one line to a current Sonnet id.
- **BookVault API.** `netlify/functions/_shared/bookvault.js` uses a sensible
  default endpoint and request shape; confirm the exact endpoint URL, auth
  header and field names against BookVault's current API docs (override the URL
  via `BOOKVAULT_API_URL` if needed). The print **cover** PDF
  (`_shared/pdf.js buildCoverPdf`) uses a nominal bleed + spine — confirm
  against BookVault's cover template spec for SKUs `150CWGPB216H216W`
  (softcover) and `150CWGHB216H216W` (hardcover).
- **pg_cron seconds interval.** Migration 05 uses `'60 seconds'` (pg_cron 1.5+).
  If the project's pg_cron is older, switch to the `'* * * * *'` 1-minute form
  noted in the file.

---

## End-to-end verification checklist

Everything below is wired and builds, but these steps exercise live third
parties (real payments, real emails, real print orders) and must be run
against the deployed site with real credentials:

1. Place a test order → photo uploads, order row saved, redirect to Stripe.
2. Pay (Stripe test mode) → webhook fires → confirmation + admin emails →
   story generation auto-triggers.
3. Story generation completes → 22 image jobs/story queued → cron generates
   images → order reaches `images_complete`.
4. `/admin` → review images → Approve → PDFs assembled → BookVault receives
   the print order and/or the ebook email is sent.
5. Mark dispatched → dispatch email sent with tracking + `COMEBACK10`.

## Local dev

```
npm install
npm run build      # verify the frontend builds
netlify dev        # full stack locally (frontend + functions), needs env vars
```
`npm run dev` alone runs only the Vite frontend; `/api/*` calls need
`netlify dev`.
