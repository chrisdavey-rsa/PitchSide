-- Notifications: favorite_teams for digest sorting + Web Push subscriptions.
-- Also weekly email opt-in + lightweight push dedupe log.

-- ---------------------------------------------------------------------------
-- 1) profiles.favorite_teams + weekly digest opt-in
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_teams text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_email_opt_in boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.favorite_teams IS
  'Team names used to pin matching fixtures at the top of the weekly email digest.';
COMMENT ON COLUMN public.profiles.weekly_email_opt_in IS
  'When true, user receives the Monday weekly fixture digest email.';

-- Seed from supported_team when empty.
UPDATE public.profiles
SET favorite_teams = ARRAY[supported_team]
WHERE supported_team IS NOT NULL
  AND btrim(supported_team) <> ''
  AND (favorite_teams IS NULL OR cardinality(favorite_teams) = 0);

-- ---------------------------------------------------------------------------
-- 2) push_subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;

CREATE POLICY push_subscriptions_select_own
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY push_subscriptions_insert_own
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY push_subscriptions_update_own
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY push_subscriptions_delete_own
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

-- Upsert helper (endpoint unique) — keeps RLS-safe client writes simple.
CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_endpoint IS NULL OR btrim(p_endpoint) = '' THEN
    RAISE EXCEPTION 'endpoint required';
  END IF;
  IF p_p256dh IS NULL OR p_auth IS NULL THEN
    RAISE EXCEPTION 'subscription keys required';
  END IF;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
  VALUES (v_uid, p_endpoint, p_p256dh, p_auth)
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_push_subscription(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Dedupe log so hourly cron does not re-blast the same 24h reminder
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id text NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'unpicked_24h',
  sent_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT push_notification_log_unique UNIQUE (user_id, match_id, kind)
);

CREATE INDEX IF NOT EXISTS push_notification_log_match_idx
  ON public.push_notification_log (match_id);

ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

-- No client policies — service_role / edge functions only.
REVOKE ALL ON public.push_notification_log FROM anon, authenticated;
GRANT ALL ON public.push_notification_log TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Schedule edge functions (clone auth headers from an existing cron job)
-- ---------------------------------------------------------------------------
DO $cron$
DECLARE
  tmpl text;
  cmd_24h text;
  cmd_weekly text;
  j record;
BEGIN
  SELECT command INTO tmpl
  FROM cron.job
  WHERE jobname = 'sync-schedule-football'
  LIMIT 1;

  IF tmpl IS NULL OR tmpl = '' THEN
    RAISE NOTICE 'No sync-schedule-football cron template — schedule notify jobs manually.';
    RETURN;
  END IF;

  cmd_24h := replace(
    tmpl,
    '/functions/v1/sync-schedule',
    '/functions/v1/notify-24h-unpicked'
  );
  -- Drop sport body if present; empty JSON is fine.
  cmd_24h := regexp_replace(
    cmd_24h,
    'body\s*:=\s*''.*?''::jsonb',
    'body:=''{}''::jsonb',
    'gi'
  );

  cmd_weekly := replace(
    tmpl,
    '/functions/v1/sync-schedule',
    '/functions/v1/weekly-fixture-email'
  );
  cmd_weekly := regexp_replace(
    cmd_weekly,
    'body\s*:=\s*''.*?''::jsonb',
    'body:=''{}''::jsonb',
    'gi'
  );

  -- Unschedule by jobid (compatible across pg_cron versions).
  FOR j IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('notify-24h-unpicked', 'weekly-fixture-email')
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;

  -- Hourly at :12 — picks fixtures ~24h out (23.5–24.5h window).
  PERFORM cron.schedule('notify-24h-unpicked', '12 * * * *', cmd_24h);
  -- Mondays 08:00 UTC.
  PERFORM cron.schedule('weekly-fixture-email', '0 8 * * 1', cmd_weekly);
END;
$cron$;
