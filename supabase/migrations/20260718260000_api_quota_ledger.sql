-- Account-wide API-Sports daily quota ledger + same-day fixture check cache.
-- API-Sports free tier is treated as ONE shared daily limit across football+rugby
-- (same API key). Confirm via /status or x-ratelimit-* headers in production.

CREATE TABLE IF NOT EXISTS public.api_quota_usage (
  date date PRIMARY KEY,
  calls_made integer NOT NULL DEFAULT 0 CHECK (calls_made >= 0),
  last_remaining_from_header integer,
  last_limit_from_header integer,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.api_quota_usage IS
  'Account-wide API-Sports daily request counter (UTC). Shared by Node seeds and Edge Functions.';

-- Same-day cache: avoid re-querying (league, date) that already returned N fixtures today.
CREATE TABLE IF NOT EXISTS public.api_fixture_checks (
  sport text NOT NULL CHECK (sport IN ('football', 'rugby')),
  league_id integer NOT NULL,
  fixture_date date NOT NULL,
  checked_on date NOT NULL,
  fixtures_found integer NOT NULL DEFAULT 0 CHECK (fixtures_found >= 0),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (sport, league_id, fixture_date, checked_on)
);

CREATE INDEX IF NOT EXISTS api_fixture_checks_checked_on_idx
  ON public.api_fixture_checks (checked_on DESC);

ALTER TABLE public.api_quota_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_fixture_checks ENABLE ROW LEVEL SECURITY;

-- Service role / SECURITY DEFINER RPCs own writes; allow authenticated read for admin UIs.
DROP POLICY IF EXISTS "api_quota_usage_select" ON public.api_quota_usage;
CREATE POLICY "api_quota_usage_select"
  ON public.api_quota_usage FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "api_fixture_checks_select" ON public.api_fixture_checks;
CREATE POLICY "api_fixture_checks_select"
  ON public.api_fixture_checks FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.api_quota_usage TO authenticated;
GRANT SELECT ON public.api_fixture_checks TO authenticated;
GRANT ALL ON public.api_quota_usage TO service_role;
GRANT ALL ON public.api_fixture_checks TO service_role;

/**
 * Atomically reserve one API call against today's budget.
 * Returns { allowed, calls_made, budget, remaining_budget }.
 */
CREATE OR REPLACE FUNCTION public.reserve_api_quota(
  p_date date,
  p_budget integer,
  p_caller text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.api_quota_usage%ROWTYPE;
BEGIN
  IF p_budget IS NULL OR p_budget < 1 THEN
    RAISE EXCEPTION 'p_budget must be >= 1';
  END IF;

  INSERT INTO public.api_quota_usage (date, calls_made)
  VALUES (p_date, 0)
  ON CONFLICT (date) DO NOTHING;

  SELECT * INTO v_row
  FROM public.api_quota_usage
  WHERE date = p_date
  FOR UPDATE;

  IF v_row.calls_made >= p_budget THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'calls_made', v_row.calls_made,
      'budget', p_budget,
      'remaining_budget', 0,
      'caller', p_caller
    );
  END IF;

  UPDATE public.api_quota_usage
  SET
    calls_made = calls_made + 1,
    updated_at = timezone('utc', now())
  WHERE date = p_date
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'allowed', true,
    'calls_made', v_row.calls_made,
    'budget', p_budget,
    'remaining_budget', GREATEST(0, p_budget - v_row.calls_made),
    'caller', p_caller
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_api_quota_headers(
  p_date date,
  p_remaining integer,
  p_limit integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.api_quota_usage (date, calls_made, last_remaining_from_header, last_limit_from_header)
  VALUES (p_date, 0, p_remaining, p_limit)
  ON CONFLICT (date) DO UPDATE
  SET
    last_remaining_from_header = EXCLUDED.last_remaining_from_header,
    last_limit_from_header = COALESCE(EXCLUDED.last_limit_from_header, public.api_quota_usage.last_limit_from_header),
    updated_at = timezone('utc', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.get_api_quota_usage(p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.api_quota_usage%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.api_quota_usage WHERE date = p_date;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'date', p_date,
      'calls_made', 0,
      'last_remaining_from_header', NULL,
      'last_limit_from_header', NULL
    );
  END IF;
  RETURN jsonb_build_object(
    'date', v_row.date,
    'calls_made', v_row.calls_made,
    'last_remaining_from_header', v_row.last_remaining_from_header,
    'last_limit_from_header', v_row.last_limit_from_header
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_api_quota(date, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_api_quota_headers(date, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_api_quota_usage(date) TO service_role, authenticated;
