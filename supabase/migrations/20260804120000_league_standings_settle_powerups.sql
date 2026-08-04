-- Private league standings must mirror global scoring: settle with power-ups.
-- Root cause: get_league_member_predictions returned predictions.points_won,
-- which is often NULL after FT. The client then fell back to base-only
-- calculatePoints (e.g. 11) while get_global_leaderboard recomputes via
-- pitchside_settle_prediction_points (e.g. 12 with Double Bubble).

DROP FUNCTION IF EXISTS public.get_league_member_predictions(text, timestamptz);

CREATE FUNCTION public.get_league_member_predictions(
  p_league_id text,
  p_since timestamptz DEFAULT (timezone('utc', now()) - interval '7 days')
)
RETURNS TABLE(
  user_id text,
  match_id text,
  sport text,
  predicted_home_score integer,
  predicted_away_score integer,
  submitted boolean,
  points_won integer,
  kickoff_time timestamptz,
  applied_powerup_id uuid,
  powerup_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid text := auth.uid()::text;
  v_is_member boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.league_members lm
    WHERE lm.league_id = p_league_id
      AND lm.user_id = v_uid
  ) INTO v_is_member;

  IF NOT v_is_member AND NOT public.is_pitchside_admin() THEN
    RAISE EXCEPTION 'not a league member';
  END IF;

  RETURN QUERY
  SELECT
    pred.user_id::text,
    pred.match_id::text,
    pred.sport::text,
    pred.predicted_home_score,
    pred.predicted_away_score,
    pred.submitted,
    CASE
      WHEN m.status = 'completed'
           AND m.actual_home_score IS NOT NULL
           AND m.actual_away_score IS NOT NULL
      THEN (
        SELECT s.earned_points
        FROM public.pitchside_settle_prediction_points(
          pred.predicted_home_score,
          pred.predicted_away_score,
          m.actual_home_score,
          m.actual_away_score,
          pred.sport,
          up.powerup_type
        ) s
      )
      ELSE pred.points_won
    END AS points_won,
    m.kickoff_time,
    pred.applied_powerup_id,
    up.powerup_type::text
  FROM public.predictions pred
  JOIN public.matches m ON m.id = pred.match_id
  JOIN public.league_members lm
    ON lm.league_id = p_league_id
   AND lm.user_id = pred.user_id
  LEFT JOIN public.user_powerups up ON up.id = pred.applied_powerup_id
  WHERE pred.submitted = true
    AND m.kickoff_time >= p_since
  ORDER BY m.kickoff_time ASC, pred.user_id ASC;
END;
$function$;

ALTER FUNCTION public.get_league_member_predictions(text, timestamptz) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_league_member_predictions(text, timestamptz) TO authenticated;

-- Backfill null/stale points_won so direct table reads also match settle.
UPDATE public.predictions AS pred
SET points_won = sub.earned_points
FROM (
  SELECT
    p.id,
    s.earned_points
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id
  LEFT JOIN public.user_powerups up ON up.id = p.applied_powerup_id
  CROSS JOIN LATERAL public.pitchside_settle_prediction_points(
    p.predicted_home_score,
    p.predicted_away_score,
    m.actual_home_score,
    m.actual_away_score,
    p.sport,
    up.powerup_type
  ) s
  WHERE p.submitted = true
    AND m.status = 'completed'
    AND m.actual_home_score IS NOT NULL
    AND m.actual_away_score IS NOT NULL
) AS sub
WHERE pred.id = sub.id
  AND pred.points_won IS DISTINCT FROM sub.earned_points;
