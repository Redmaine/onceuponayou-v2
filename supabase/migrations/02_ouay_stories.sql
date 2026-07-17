-- =============================================================================
-- 02_ouay_stories.sql
--
-- One row per generated story. A single order can carry several stories
-- (ebook_triple, and the 3-story hardcover bundle), so story_number
-- distinguishes them within an order. Apply in the Supabase SQL editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ouay_stories (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid REFERENCES public.ouay_orders(id) ON DELETE CASCADE,
  story_number       integer NOT NULL,
  hero_name          text,
  theme              text,
  story_type         text,
  title              text,
  pages              jsonb,            -- [{ page_number, text, illustration_prompt }]
  back_cover_blurb   text,
  sense_check_passed boolean,
  sense_check_errors jsonb,
  is_ebook           boolean DEFAULT false,
  status             text DEFAULT 'pending',
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ouay_stories_order_idx ON public.ouay_stories (order_id);

ALTER TABLE public.ouay_stories ENABLE ROW LEVEL SECURITY;
