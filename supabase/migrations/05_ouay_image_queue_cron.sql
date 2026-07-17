-- =============================================================================
-- 05_ouay_image_queue_cron.sql
--
-- Schedules the ouay-process-image-queue edge function to run every 60
-- seconds. It picks up to 3 pending image jobs per run, polls Replicate, and
-- saves finished images — see supabase/functions/ouay-process-image-queue.
--
-- BEFORE running this file:
--   1. Deploy the edge function first:
--        supabase functions deploy ouay-process-image-queue \
--          --project-ref fvyvtdwsomxfkpxwygpk --no-verify-jwt
--   2. Replace <<SERVICE_ROLE_KEY>> below with the project's service_role key
--      (Supabase dashboard → Project Settings → API). Do NOT commit the real
--      key back into this file — it lives only in the SQL editor at run time.
--
-- Apply in the Supabase SQL editor.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any earlier copy of this job so re-running the file is idempotent.
SELECT cron.unschedule('ouay-process-image-queue')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ouay-process-image-queue');

-- pg_cron 1.5+ (available on Supabase) accepts a seconds interval string.
-- If your project's pg_cron predates that, use the 1-minute form instead:
--   '* * * * *'
SELECT cron.schedule(
  'ouay-process-image-queue',
  '60 seconds',
  $$
  SELECT net.http_post(
    url     := 'https://fvyvtdwsomxfkpxwygpk.supabase.co/functions/v1/ouay-process-image-queue',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <<SERVICE_ROLE_KEY>>'
    ),
    body    := jsonb_build_object('trigger', 'cron')
  );
  $$
);
