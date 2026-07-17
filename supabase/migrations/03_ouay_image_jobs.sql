-- =============================================================================
-- 03_ouay_image_jobs.sql
--
-- One row per image to generate (cover + 20 pages + back cover = 22 per
-- story). Processed asynchronously by the ouay-process-image-queue edge
-- function on a 60-second pg_cron schedule. Apply in the Supabase SQL editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ouay_image_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid REFERENCES public.ouay_orders(id) ON DELETE CASCADE,
  story_id      uuid REFERENCES public.ouay_stories(id) ON DELETE CASCADE,
  job_key       text UNIQUE NOT NULL,   -- e.g. "<story_id>:cover", "<story_id>:page_7"
  page_number   integer,               -- 0 cover, 1..20 pages, 99 back cover
  prompt        text,
  hero_ref_url  text,                  -- character reference passed as input image
  prediction_id text,
  image_url     text,
  status        text DEFAULT 'pending', -- pending | processing | complete | failed
  attempts      integer DEFAULT 0,
  error_message text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ouay_image_jobs_status_idx ON public.ouay_image_jobs (status);
CREATE INDEX IF NOT EXISTS ouay_image_jobs_story_idx  ON public.ouay_image_jobs (story_id);
CREATE INDEX IF NOT EXISTS ouay_image_jobs_order_idx  ON public.ouay_image_jobs (order_id);

ALTER TABLE public.ouay_image_jobs ENABLE ROW LEVEL SECURITY;
