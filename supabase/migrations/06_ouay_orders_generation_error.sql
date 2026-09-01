-- =============================================================================
-- 06_ouay_orders_generation_error.sql
--
-- Order OAY-17882023569687494 ("Lottie", 31 Aug 2026) failed generation, but
-- generate-story-background only ever wrote the failure to console.error —
-- nothing was persisted on the order row. Diagnosing the real cause required
-- inferring it from indirect evidence (ouay_stories row count, failure
-- timing) rather than reading a real error message, and a second real test
-- failure during verification of this exact fix hit the same blind spot.
--
-- Adds a place to put the real reason, matching the *_error column pattern
-- already used elsewhere (e.g. this session's mkt_content_queue.caption_error
-- for the CRHQ Reels pipeline) — so the next generation_failed order is
-- diagnosable by reading the row, not by re-deriving it from scratch.
-- =============================================================================

alter table public.ouay_orders add column if not exists generation_error text;

comment on column public.ouay_orders.generation_error is
  'Real error message from the last failed generate-story-background run, if status is generation_failed. Cleared (set null) once a retry succeeds.';
