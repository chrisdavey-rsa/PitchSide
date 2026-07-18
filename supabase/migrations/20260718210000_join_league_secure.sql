-- Secure league join: password verified server-side; membership insert only via RPC.
-- Client must never SELECT leagues.password (enforced in app selects + this join path).

CREATE OR REPLACE FUNCTION public.join_league_secure(
  _league_id text,
  _user_id text,
  _password text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league public.leagues%ROWTYPE;
  v_member_count integer;
  v_max integer;
  v_expected text;
  v_provided text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF auth.uid()::text IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Not authorized to join as another user'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_league
  FROM public.leagues
  WHERE id = _league_id
    AND COALESCE(is_archived, false) = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'League not found'
      USING ERRCODE = 'P0002';
  END IF;

  v_expected := trim(COALESCE(v_league.password, ''));
  v_provided := trim(COALESCE(_password, ''));

  -- Empty stored password = open join; otherwise require an exact match.
  IF v_expected <> '' AND v_expected IS DISTINCT FROM v_provided THEN
    RAISE EXCEPTION 'Incorrect password'
      USING ERRCODE = 'P0001';
  END IF;

  -- Capacity (Global League uncapped: max_players NULL or sentinel id).
  IF v_league.id IS DISTINCT FROM 'GLOBAL_LEAGUE' THEN
    v_max := COALESCE(v_league.max_players, v_league.max_participants);
    IF v_max IS NOT NULL THEN
      SELECT COUNT(*)::integer
      INTO v_member_count
      FROM public.league_members
      WHERE league_id = _league_id;

      IF v_member_count >= v_max THEN
        RAISE EXCEPTION 'League is full'
          USING ERRCODE = 'P0003';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.league_members (league_id, user_id, joined_at)
  VALUES (_league_id, _user_id, NOW())
  ON CONFLICT (league_id, user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.join_league_secure(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_league_secure(text, text, text) TO authenticated;

COMMENT ON FUNCTION public.join_league_secure(text, text, text) IS
  'Verifies league join password server-side and inserts league_members. Call from clients instead of direct INSERT.';

-- Block direct client INSERT into league_members (join must go through the RPC).
DROP POLICY IF EXISTS "league_members join self" ON public.league_members;
DROP POLICY IF EXISTS "league_members insert via rpc only" ON public.league_members;

-- No INSERT policy for anon/authenticated: SECURITY DEFINER RPC bypasses RLS as owner.
