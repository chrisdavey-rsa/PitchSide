-- Split API-Sports quota ledger by sport: football and rugby each get their
-- own daily counter (DAILY_BUDGET_CAP each). Confirmed via independent
-- x-ratelimit-requests-limit/remaining headers per host.

-- Drop old single-date RPCs (signatures change).
DROP FUNCTION IF EXISTS public.reserve_api_quota(date, integer, text);
DROP FUNCTION IF EXISTS public.record_api_quota_headers(date, integer, integer);
DROP FUNCTION IF EXISTS public.get_api_quota_usage(date);

-- Rebuild ledger keyed by (date, sport).
ALTER TABLE IF EXISTS public.api_quota_usage
  DROP CONSTRAINT IF EXISTS api_quota_usage_pkey;

ALTER TABLE public.api_quota_usage
  ADD COLUMN IF NOT EXISTS sport text;

-- Migrate any existing date-only rows into football (conservative: rugby starts fresh).
UPDATE public.api_quota_usage
SET sport = 'football'
WHERE sport IS NULL;

ALTER TABLE public.api_quota_usage
  ALTER COLUMN sport SET NOT NULL;

ALTER TABLE public.api_quota_usage
  DROP CONSTRAINT IF EXISTS api_quota_usage_sport_check;

ALTER TABLE public.api_quota_usage
  ADD CONSTRAINT api_quota_usage_sport_check
  CHECK (sport IN ('football', 'rugby'));

ALTER TABLE public.api_quota_usage
  ADD PRIMARY KEY (date, sport);

COMMENT ON TABLE public.api_quota_usage IS
  'Per-sport API-Sports daily request counters (UTC). Football and rugby budgets are independent.';

CREATE OR REPLACE FUNCTION public.reserve_api_quota(
  p_date date,
  p_sport text,
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
  IF p_sport IS NULL OR p_sport NOT IN ('football', 'rugby') THEN
    RAISE EXCEPTION 'p_sport must be football or rugby';
  END IF;
  IF p_budget IS NULL OR p_budget < 1 THEN
    RAISE EXCEPTION 'p_budget must be >= 1';
  END IF;

  INSERT INTO public.api_quota_usage (date, sport, calls_made)
  VALUES (p_date, p_sport, 0)
  ON CONFLICT (date, sport) DO NOTHING;

  SELECT * INTO v_row
  FROM public.api_quota_usage
  WHERE date = p_date AND sport = p_sport
  FOR UPDATE;

  IF v_row.calls_made >= p_budget THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'calls_made', v_row.calls_made,
      'budget', p_budget,
      'remaining_budget', 0,
      'sport', p_sport,
      'caller', p_caller
    );
  END IF;

  UPDATE public.api_quota_usage
  SET
    calls_made = calls_made + 1,
    updated_at = timezone('utc', now())
  WHERE date = p_date AND sport = p_sport
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'allowed', true,
    'calls_made', v_row.calls_made,
    'budget', p_budget,
    'remaining_budget', GREATEST(0, p_budget - v_row.calls_made),
    'sport', p_sport,
    'caller', p_caller
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_api_quota_headers(
  p_date date,
  p_sport text,
  p_remaining integer,
  p_limit integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_sport IS NULL OR p_sport NOT IN ('football', 'rugby') THEN
    RAISE EXCEPTION 'p_sport must be football or rugby';
  END IF;

  INSERT INTO public.api_quota_usage (
    date, sport, calls_made, last_remaining_from_header, last_limit_from_header
  )
  VALUES (p_date, p_sport, 0, p_remaining, p_limit)
  ON CONFLICT (date, sport) DO UPDATE
  SET
    last_remaining_from_header = EXCLUDED.last_remaining_from_header,
    last_limit_from_header = COALESCE(
      EXCLUDED.last_limit_from_header,
      public.api_quota_usage.last_limit_from_header
    ),
    updated_at = timezone('utc', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.get_api_quota_usage(
  p_date date,
  p_sport text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.api_quota_usage%ROWTYPE;
BEGIN
  IF p_sport IS NULL OR p_sport NOT IN ('football', 'rugby') THEN
    RAISE EXCEPTION 'p_sport must be football or rugby';
  END IF;

  SELECT * INTO v_row
  FROM public.api_quota_usage
  WHERE date = p_date AND sport = p_sport;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'date', p_date,
      'sport', p_sport,
      'calls_made', 0,
      'last_remaining_from_header', NULL,
      'last_limit_from_header', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'date', v_row.date,
    'sport', v_row.sport,
    'calls_made', v_row.calls_made,
    'last_remaining_from_header', v_row.last_remaining_from_header,
    'last_limit_from_header', v_row.last_limit_from_header
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_api_quota(date, text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_api_quota_headers(date, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_api_quota_usage(date, text) TO service_role, authenticated;
