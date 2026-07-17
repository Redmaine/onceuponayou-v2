-- =============================================================================
-- 01_ouay_orders.sql
--
-- Orders for Once Upon A You. All tables are prefixed ouay_ because this app
-- shares the YCA Supabase project (fvyvtdwsomxfkpxwygpk) with other brands.
--
-- Apply in the Supabase SQL editor — NOT via the Supabase CLI. This project
-- has a known schema_migrations history drift, so `supabase db push` is
-- unreliable here; paste-and-run each file in order in the SQL editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ouay_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref         text UNIQUE NOT NULL,
  stripe_payment_id text,
  customer_name     text,
  customer_email    text,
  delivery_name     text,
  delivery_address  jsonb,               -- { line1, line2, town, county, postcode, country }
  hero_name         text NOT NULL,
  hero_age          integer NOT NULL,
  hero_gender       text NOT NULL,       -- boy | girl | child
  hero_hair         text,
  hero_skin         text,
  hero_features     text,
  hero_photo_url    text,
  hero_ref_url      text,                -- generated character-reference image
  story_type        text NOT NULL,       -- adventure | love | growing
  theme             text,
  theme2            text,
  theme3            text,
  dedication        text,
  product_type      text NOT NULL,
  amount_paid       integer,             -- pence
  status            text DEFAULT 'new',
  ebook_pdf_url     text,
  interior_pdf_url  text,
  cover_pdf_url     text,
  tracking_number   text,
  dispatched_at     timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ouay_orders_status_idx     ON public.ouay_orders (status);
CREATE INDEX IF NOT EXISTS ouay_orders_created_at_idx ON public.ouay_orders (created_at DESC);

-- RLS on, no public policies: every read/write goes through Netlify functions
-- using the service key (which bypasses RLS). The anon key can never touch
-- these rows — orders contain customer + child personal data.
ALTER TABLE public.ouay_orders ENABLE ROW LEVEL SECURITY;
