-- Member-only league password fetch for Invite Friend share links.
-- League ids are TEXT in this schema (e.g. LG_XXXXX), not uuid.

CREATE OR REPLACE FUNCTION public.get_league_password(_league_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text;
  v_password text;
BEGIN
  v_uid := auth.uid()::text;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.league_members lm
    WHERE lm.league_id = _league_id
      AND lm.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not a member of this league'
      USING ERRCODE = '42501';
  END IF;

  SELECT l.password
  INTO v_password
  FROM public.leagues l
  WHERE l.id = _league_id
    AND COALESCE(l.is_archived, false) = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'League not found'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN COALESCE(v_password, '');
END;
$$;

REVOKE ALL ON FUNCTION public.get_league_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_league_password(text) TO authenticated;

COMMENT ON FUNCTION public.get_league_password(text) IS
  'Returns the join password only when auth.uid() is a member of the league.';
