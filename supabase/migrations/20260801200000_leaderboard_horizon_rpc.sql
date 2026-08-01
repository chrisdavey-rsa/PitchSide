-- Horizon-scoped global leaderboard (This Week / This Month).
-- SECURITY DEFINER so clients can aggregate peers despite predictions RLS.
-- Season totals continue to use get_global_leaderboard (with gameweek drops).

CREATE OR REPLACE FUNCTION public.get_global_leaderboard_horizon(
  p_horizon text DEFAULT 'week',
  p_current_user_id text DEFAULT NULL
)
RETURNS TABLE(
  player_id text,
  nickname text,
  first_name text,
  surname text,
  nationality text,
  points_football bigint,
  points_rugby bigint,
  predictions_football bigint,
  predictions_rugby bigint,
  total_points bigint,
  is_profile_public boolean,
  ghost_points bigint,
  ghost_points_football bigint,
  ghost_points_rugby bigint,
  drops_used integer,
  drops_used_football integer,
  drops_used_rugby integer,
  drops_allowed integer,
  drops_allowed_football integer,
  drops_allowed_rugby integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH bounds AS (
    SELECT
      CASE lower(coalesce(p_horizon, 'week'))
        WHEN 'month' THEN date_trunc('month', timezone('utc', now()))
        WHEN 'season' THEN make_timestamptz(2026, 1, 1, 0, 0, 0, 'UTC')
        ELSE timezone('utc', now()) - interval '7 days'
      END AS start_at,
      timezone('utc', now()) AS end_at
  ),
  scored AS (
    SELECT
      pred.user_id,
      pred.sport,
      (
        SELECT s.earned_points
        FROM public.pitchside_settle_prediction_points(
          pred.predicted_home_score,
          pred.predicted_away_score,
          m.actual_home_score,
          m.actual_away_score,
          pred.sport,
          up.powerup_type
        ) s
      ) AS points,
      CASE
        WHEN (
          SELECT s.earned_points
          FROM public.pitchside_settle_prediction_points(
            pred.predicted_home_score,
            pred.predicted_away_score,
            m.actual_home_score,
            m.actual_away_score,
            pred.sport,
            up.powerup_type
          ) s
        ) > 0 THEN 1
        ELSE 0
      END AS correct_hit
    FROM public.predictions pred
    JOIN public.matches m ON m.id = pred.match_id
    LEFT JOIN public.user_powerups up ON up.id = pred.applied_powerup_id
    CROSS JOIN bounds b
    WHERE pred.submitted = true
      AND m.status = 'completed'
      AND m.actual_home_score IS NOT NULL
      AND m.actual_away_score IS NOT NULL
      AND m.kickoff_time >= b.start_at
      AND m.kickoff_time <= b.end_at
  ),
  aggregates AS (
    SELECT
      user_id,
      COALESCE(SUM(points) FILTER (WHERE sport = 'football'), 0)::bigint AS points_football,
      COALESCE(SUM(points) FILTER (WHERE sport = 'rugby'), 0)::bigint AS points_rugby,
      COUNT(*) FILTER (WHERE sport = 'football')::bigint AS predictions_football,
      COUNT(*) FILTER (WHERE sport = 'rugby')::bigint AS predictions_rugby
    FROM scored
    GROUP BY user_id
  )
  SELECT
    p.id::text AS player_id,
    COALESCE(p.username, 'Contestant') AS nickname,
    COALESCE(p.first_name, '') AS first_name,
    COALESCE(p.surname, '') AS surname,
    COALESCE(p.nationality, 'United Kingdom') AS nationality,
    a.points_football,
    a.points_rugby,
    a.predictions_football,
    a.predictions_rugby,
    (a.points_football + a.points_rugby)::bigint AS total_points,
    COALESCE(p.is_profile_public, true) AS is_profile_public,
    (a.points_football + a.points_rugby)::bigint AS ghost_points,
    a.points_football AS ghost_points_football,
    a.points_rugby AS ghost_points_rugby,
    0 AS drops_used,
    0 AS drops_used_football,
    0 AS drops_used_rugby,
    0 AS drops_allowed,
    0 AS drops_allowed_football,
    0 AS drops_allowed_rugby
  FROM aggregates a
  JOIN public.profiles p ON p.id::text = a.user_id
  WHERE (a.predictions_football + a.predictions_rugby) > 0
  ORDER BY (a.points_football + a.points_rugby) DESC, p.username ASC;
$function$;

ALTER FUNCTION public.get_global_leaderboard_horizon(text, text) SET search_path = public;
ALTER FUNCTION public.get_global_leaderboard_horizon(text, text) SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.get_global_leaderboard_horizon(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_leaderboard_horizon(text, text) TO anon;
