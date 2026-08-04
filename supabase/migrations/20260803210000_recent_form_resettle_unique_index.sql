-- Scalability: unique (user_id, match_id), recent form RPC, force resettle for admin overrides.
-- Note: predictions use match_id (not fixture_id).

-- No duplicate (user_id, match_id) rows present at authoring time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_match
  ON public.predictions (user_id, match_id);

-- Alias name requested in product brief (fixture_id ≡ match_id in this schema).
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_fixture
  ON public.predictions (user_id, match_id);

-- -----------------------------------------------------------------------------
-- Last N completed picks for player profile "Recent Form"
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_player_recent_form(
  p_player_id text,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(
  match_id text,
  sport text,
  home_team text,
  away_team text,
  kickoff_time timestamptz,
  actual_home integer,
  actual_away integer,
  predicted_home integer,
  predicted_away integer,
  base_points integer,
  earned_points integer,
  outcome_tier text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    m.id::text AS match_id,
    m.sport::text,
    m.home_team::text,
    m.away_team::text,
    m.kickoff_time,
    m.actual_home_score AS actual_home,
    m.actual_away_score AS actual_away,
    pred.predicted_home_score AS predicted_home,
    pred.predicted_away_score AS predicted_away,
    public.pitchside_base_prediction_points(
      m.sport,
      pred.predicted_home_score,
      pred.predicted_away_score,
      m.actual_home_score,
      m.actual_away_score
    ) AS base_points,
    COALESCE(pred.points_won, 0) AS earned_points,
    CASE
      WHEN public.pitchside_base_prediction_points(
        m.sport,
        pred.predicted_home_score,
        pred.predicted_away_score,
        m.actual_home_score,
        m.actual_away_score
      ) = 5 THEN 'perfect'
      WHEN public.pitchside_base_prediction_points(
        m.sport,
        pred.predicted_home_score,
        pred.predicted_away_score,
        m.actual_home_score,
        m.actual_away_score
      ) > 0 THEN 'correct'
      ELSE 'wrong'
    END AS outcome_tier
  FROM public.predictions pred
  JOIN public.matches m ON m.id = pred.match_id
  WHERE pred.user_id = p_player_id
    AND pred.submitted = true
    AND m.status = 'completed'
    AND m.actual_home_score IS NOT NULL
    AND m.actual_away_score IS NOT NULL
  ORDER BY m.kickoff_time DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 5), 20));
END;
$function$;

ALTER FUNCTION public.get_player_recent_form(text, integer) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_player_recent_form(text, integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- Admin: overwrite FT score + recalculate all prediction points for the match
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.force_resettle_match(
  p_match_id text,
  p_home_score integer,
  p_away_score integer
)
RETURNS TABLE(
  updated_predictions integer,
  home_score integer,
  away_score integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_count integer := 0;
  v_sport text;
  r RECORD;
  v_earned integer;
  v_banker boolean;
  v_powerup public.powerup_type;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_pitchside_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF p_home_score IS NULL OR p_away_score IS NULL OR p_home_score < 0 OR p_away_score < 0 THEN
    RAISE EXCEPTION 'invalid scores';
  END IF;

  SELECT m.sport INTO v_sport
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_sport IS NULL THEN
    RAISE EXCEPTION 'match not found';
  END IF;

  UPDATE public.matches
  SET
    actual_home_score = p_home_score,
    actual_away_score = p_away_score,
    status = 'completed',
    provisional_home_score = p_home_score,
    provisional_away_score = p_away_score
  WHERE id = p_match_id;

  FOR r IN
    SELECT
      pred.id AS prediction_id,
      pred.predicted_home_score,
      pred.predicted_away_score,
      up.powerup_type
    FROM public.predictions pred
    LEFT JOIN public.user_powerups up ON up.id = pred.applied_powerup_id
    WHERE pred.match_id = p_match_id
      AND pred.submitted = true
  LOOP
    SELECT s.earned_points, s.is_banker_exact
    INTO v_earned, v_banker
    FROM public.pitchside_settle_prediction_points(
      r.predicted_home_score,
      r.predicted_away_score,
      p_home_score,
      p_away_score,
      v_sport,
      r.powerup_type
    ) s;

    UPDATE public.predictions
    SET
      points_won = v_earned,
      is_banker_exact = v_banker,
      provisional_points = 0
    WHERE id = r.prediction_id;

    v_count := v_count + 1;
  END LOOP;

  updated_predictions := v_count;
  home_score := p_home_score;
  away_score := p_away_score;
  RETURN NEXT;
END;
$function$;

ALTER FUNCTION public.force_resettle_match(text, integer, integer) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.force_resettle_match(text, integer, integer) TO authenticated;

-- Product alias (fixture_id ≡ match_id).
CREATE OR REPLACE FUNCTION public.force_resettle_fixture(
  p_fixture_id text,
  p_home_score integer,
  p_away_score integer
)
RETURNS TABLE(
  updated_predictions integer,
  home_score integer,
  away_score integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT * FROM public.force_resettle_match(p_fixture_id, p_home_score, p_away_score);
$function$;

ALTER FUNCTION public.force_resettle_fixture(text, integer, integer) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.force_resettle_fixture(text, integer, integer) TO authenticated;

-- Leaderboard cascading sort (points → Perfect Predictions → Strike Rate → username)
-- is enforced client-side in LeaderboardsPage / mapLeaderboardForSport because SQL
-- ORDER BY cannot safely reference SELECT aliases inside expressions in these RPCs.
