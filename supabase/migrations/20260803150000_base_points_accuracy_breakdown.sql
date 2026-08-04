-- Base-points accuracy + prediction outcome tier counts for profile drill-down.

-- -----------------------------------------------------------------------------
-- Helper: base points for a prediction (no power-up multipliers)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pitchside_base_prediction_points(
  p_sport text,
  p_predicted_home integer,
  p_predicted_away integer,
  p_actual_home integer,
  p_actual_away integer
) RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT CASE
    WHEN lower(coalesce(p_sport, 'football')) = 'football'
      THEN public.pitchside_football_points(
        p_predicted_home, p_predicted_away, p_actual_home, p_actual_away
      )
    ELSE public.pitchside_rugby_points(
      p_predicted_home, p_predicted_away, p_actual_home, p_actual_away
    )
  END;
$function$;

GRANT EXECUTE ON FUNCTION public.pitchside_base_prediction_points(text, integer, integer, integer, integer)
  TO authenticated, anon, service_role;

-- -----------------------------------------------------------------------------
-- Season leaderboard
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_global_leaderboard(text);

CREATE OR REPLACE FUNCTION public.get_global_leaderboard(
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
  settled_predictions_football bigint,
  settled_predictions_rugby bigint,
  base_points_football bigint,
  base_points_rugby bigint,
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
  drops_allowed_rugby integer,
  perfect_hits_football bigint,
  perfect_hits_rugby bigint,
  correct_outcomes_football bigint,
  correct_outcomes_rugby bigint,
  hits_exact_football bigint,
  hits_close_football bigint,
  hits_winner_football bigint,
  hits_wrong_football bigint,
  hits_exact_rugby bigint,
  hits_close_rugby bigint,
  hits_winner_rugby bigint,
  hits_wrong_rugby bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH scored AS (
    SELECT
      pred.user_id,
      pred.sport,
      COALESCE(m.competition_id, pred.competition_id) AS competition_id,
      COALESCE(m.round_name, to_char(date_trunc('week', m.kickoff_time), 'IYYY-"W"IW')) AS gameweek_key,
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
      public.pitchside_base_prediction_points(
        pred.sport,
        pred.predicted_home_score,
        pred.predicted_away_score,
        m.actual_home_score,
        m.actual_away_score
      ) AS base_points,
      CASE
        WHEN (
          CASE
            WHEN pred.predicted_home_score > pred.predicted_away_score THEN 'home'
            WHEN pred.predicted_home_score < pred.predicted_away_score THEN 'away'
            ELSE 'draw'
          END
        ) = (
          CASE
            WHEN m.actual_home_score > m.actual_away_score THEN 'home'
            WHEN m.actual_home_score < m.actual_away_score THEN 'away'
            ELSE 'draw'
          END
        ) THEN true
        ELSE false
      END AS outcome_ok,
      CASE
        WHEN pred.sport = 'football'
             AND pred.predicted_home_score = m.actual_home_score
             AND pred.predicted_away_score = m.actual_away_score
          THEN true
        WHEN pred.sport = 'rugby'
             AND (
               CASE
                 WHEN pred.predicted_home_score > pred.predicted_away_score THEN 'home'
                 WHEN pred.predicted_home_score < pred.predicted_away_score THEN 'away'
                 ELSE 'draw'
               END
             ) = (
               CASE
                 WHEN m.actual_home_score > m.actual_away_score THEN 'home'
                 WHEN m.actual_home_score < m.actual_away_score THEN 'away'
                 ELSE 'draw'
               END
             )
             AND abs(
               (pred.predicted_home_score - pred.predicted_away_score)
               - (m.actual_home_score - m.actual_away_score)
             ) = 0
          THEN true
        ELSE false
      END AS perfect_ok
    FROM public.predictions pred
    JOIN public.matches m ON m.id = pred.match_id
    LEFT JOIN public.user_powerups up ON up.id = pred.applied_powerup_id
    WHERE pred.submitted = true
      AND m.status = 'completed'
      AND m.actual_home_score IS NOT NULL
      AND m.actual_away_score IS NOT NULL
  ),
  prediction_counts AS (
    SELECT
      pred.user_id,
      COUNT(*) FILTER (WHERE pred.sport = 'football') AS predictions_football,
      COUNT(*) FILTER (WHERE pred.sport = 'rugby') AS predictions_rugby
    FROM public.predictions pred
    WHERE pred.submitted = true
    GROUP BY pred.user_id
  ),
  hit_counts AS (
    SELECT
      user_id,
      COUNT(*) FILTER (WHERE sport = 'football') AS settled_predictions_football,
      COUNT(*) FILTER (WHERE sport = 'rugby') AS settled_predictions_rugby,
      COALESCE(SUM(base_points) FILTER (WHERE sport = 'football'), 0) AS base_points_football,
      COALESCE(SUM(base_points) FILTER (WHERE sport = 'rugby'), 0) AS base_points_rugby,
      COUNT(*) FILTER (WHERE sport = 'football' AND perfect_ok) AS perfect_hits_football,
      COUNT(*) FILTER (WHERE sport = 'rugby' AND perfect_ok) AS perfect_hits_rugby,
      COUNT(*) FILTER (WHERE sport = 'football' AND outcome_ok) AS correct_outcomes_football,
      COUNT(*) FILTER (WHERE sport = 'rugby' AND outcome_ok) AS correct_outcomes_rugby,
      COUNT(*) FILTER (WHERE sport = 'football' AND base_points = 5) AS hits_exact_football,
      COUNT(*) FILTER (WHERE sport = 'football' AND base_points = 3) AS hits_close_football,
      COUNT(*) FILTER (WHERE sport = 'football' AND base_points = 1) AS hits_winner_football,
      COUNT(*) FILTER (WHERE sport = 'football' AND base_points = 0) AS hits_wrong_football,
      COUNT(*) FILTER (WHERE sport = 'rugby' AND base_points = 5) AS hits_exact_rugby,
      COUNT(*) FILTER (WHERE sport = 'rugby' AND base_points = 3) AS hits_close_rugby,
      COUNT(*) FILTER (WHERE sport = 'rugby' AND base_points = 1) AS hits_winner_rugby,
      COUNT(*) FILTER (WHERE sport = 'rugby' AND base_points = 0) AS hits_wrong_rugby
    FROM scored
    GROUP BY user_id
  ),
  by_week AS (
    SELECT
      user_id,
      sport,
      competition_id,
      gameweek_key,
      SUM(points)::integer AS week_points
    FROM scored
    GROUP BY user_id, sport, competition_id, gameweek_key
  ),
  ranked AS (
    SELECT
      bw.user_id,
      bw.sport,
      bw.competition_id,
      bw.week_points,
      public.pitchside_competition_drops(bw.competition_id) AS drops_allowed,
      ROW_NUMBER() OVER (
        PARTITION BY bw.user_id, bw.competition_id
        ORDER BY bw.week_points ASC, bw.gameweek_key
      ) AS rn_asc,
      COUNT(*) OVER (
        PARTITION BY bw.user_id, bw.competition_id
      ) AS weeks_played
    FROM by_week bw
  ),
  comp_final AS (
    SELECT
      r.user_id,
      r.sport,
      r.competition_id,
      MAX(r.drops_allowed)::integer AS drops_allowed,
      CASE
        WHEN MAX(r.weeks_played) > MAX(r.drops_allowed)
        THEN MAX(r.drops_allowed)
        ELSE 0
      END::integer AS drops_used,
      SUM(r.week_points)::bigint AS ghost_points,
      SUM(
        CASE
          WHEN r.weeks_played > r.drops_allowed
               AND r.rn_asc <= r.drops_allowed
          THEN 0
          ELSE r.week_points
        END
      )::bigint AS best_points
    FROM ranked r
    GROUP BY r.user_id, r.sport, r.competition_id
  ),
  sport_agg AS (
    SELECT
      cf.user_id,
      COALESCE(SUM(cf.best_points) FILTER (WHERE cf.sport = 'football'), 0) AS points_football,
      COALESCE(SUM(cf.best_points) FILTER (WHERE cf.sport = 'rugby'), 0) AS points_rugby,
      COALESCE(SUM(cf.ghost_points) FILTER (WHERE cf.sport = 'football'), 0) AS ghost_football,
      COALESCE(SUM(cf.ghost_points) FILTER (WHERE cf.sport = 'rugby'), 0) AS ghost_rugby,
      COALESCE(SUM(cf.drops_used) FILTER (WHERE cf.sport = 'football'), 0) AS drops_used_football,
      COALESCE(SUM(cf.drops_used) FILTER (WHERE cf.sport = 'rugby'), 0) AS drops_used_rugby,
      COALESCE(SUM(cf.drops_allowed) FILTER (WHERE cf.sport = 'football'), 0) AS drops_allowed_football,
      COALESCE(SUM(cf.drops_allowed) FILTER (WHERE cf.sport = 'rugby'), 0) AS drops_allowed_rugby
    FROM comp_final cf
    GROUP BY cf.user_id
  )
  SELECT
    p.id AS player_id,
    COALESCE(p.username, 'Contestant') AS nickname,
    COALESCE(p.first_name, '') AS first_name,
    COALESCE(p.surname, '') AS surname,
    COALESCE(p.nationality, 'United Kingdom') AS nationality,
    COALESCE(sa.points_football, 0) AS points_football,
    COALESCE(sa.points_rugby, 0) AS points_rugby,
    COALESCE(pc.predictions_football, 0) AS predictions_football,
    COALESCE(pc.predictions_rugby, 0) AS predictions_rugby,
    COALESCE(hc.settled_predictions_football, 0) AS settled_predictions_football,
    COALESCE(hc.settled_predictions_rugby, 0) AS settled_predictions_rugby,
    COALESCE(hc.base_points_football, 0) AS base_points_football,
    COALESCE(hc.base_points_rugby, 0) AS base_points_rugby,
    COALESCE(sa.points_football, 0) + COALESCE(sa.points_rugby, 0) AS total_points,
    COALESCE(p.is_profile_public, true) AS is_profile_public,
    COALESCE(sa.ghost_football, 0) + COALESCE(sa.ghost_rugby, 0) AS ghost_points,
    COALESCE(sa.ghost_football, 0) AS ghost_points_football,
    COALESCE(sa.ghost_rugby, 0) AS ghost_points_rugby,
    (COALESCE(sa.drops_used_football, 0) + COALESCE(sa.drops_used_rugby, 0))::int AS drops_used,
    COALESCE(sa.drops_used_football, 0)::int AS drops_used_football,
    COALESCE(sa.drops_used_rugby, 0)::int AS drops_used_rugby,
    (COALESCE(sa.drops_allowed_football, 0) + COALESCE(sa.drops_allowed_rugby, 0))::int AS drops_allowed,
    COALESCE(sa.drops_allowed_football, 0)::int AS drops_allowed_football,
    COALESCE(sa.drops_allowed_rugby, 0)::int AS drops_allowed_rugby,
    COALESCE(hc.perfect_hits_football, 0) AS perfect_hits_football,
    COALESCE(hc.perfect_hits_rugby, 0) AS perfect_hits_rugby,
    COALESCE(hc.correct_outcomes_football, 0) AS correct_outcomes_football,
    COALESCE(hc.correct_outcomes_rugby, 0) AS correct_outcomes_rugby,
    COALESCE(hc.hits_exact_football, 0) AS hits_exact_football,
    COALESCE(hc.hits_close_football, 0) AS hits_close_football,
    COALESCE(hc.hits_winner_football, 0) AS hits_winner_football,
    COALESCE(hc.hits_wrong_football, 0) AS hits_wrong_football,
    COALESCE(hc.hits_exact_rugby, 0) AS hits_exact_rugby,
    COALESCE(hc.hits_close_rugby, 0) AS hits_close_rugby,
    COALESCE(hc.hits_winner_rugby, 0) AS hits_winner_rugby,
    COALESCE(hc.hits_wrong_rugby, 0) AS hits_wrong_rugby
  FROM public.profiles p
  LEFT JOIN sport_agg sa ON sa.user_id = p.id
  LEFT JOIN prediction_counts pc ON pc.user_id = p.id
  LEFT JOIN hit_counts hc ON hc.user_id = p.id
  WHERE p.username IS NOT NULL
    AND p.username NOT LIKE 'freed_nick_%'
  ORDER BY total_points DESC, nickname ASC;
$function$;

ALTER FUNCTION public.get_global_leaderboard(text) SET search_path = public;
ALTER FUNCTION public.get_global_leaderboard(text) SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.get_global_leaderboard(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_leaderboard(text) TO anon;

-- -----------------------------------------------------------------------------
-- Horizon leaderboard
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_global_leaderboard_horizon(text, text);

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
  settled_predictions_football bigint,
  settled_predictions_rugby bigint,
  base_points_football bigint,
  base_points_rugby bigint,
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
  drops_allowed_rugby integer,
  perfect_hits_football bigint,
  perfect_hits_rugby bigint,
  correct_outcomes_football bigint,
  correct_outcomes_rugby bigint,
  hits_exact_football bigint,
  hits_close_football bigint,
  hits_winner_football bigint,
  hits_wrong_football bigint,
  hits_exact_rugby bigint,
  hits_close_rugby bigint,
  hits_winner_rugby bigint,
  hits_wrong_rugby bigint
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
      public.pitchside_base_prediction_points(
        pred.sport,
        pred.predicted_home_score,
        pred.predicted_away_score,
        m.actual_home_score,
        m.actual_away_score
      ) AS base_points,
      CASE
        WHEN (
          CASE
            WHEN pred.predicted_home_score > pred.predicted_away_score THEN 'home'
            WHEN pred.predicted_home_score < pred.predicted_away_score THEN 'away'
            ELSE 'draw'
          END
        ) = (
          CASE
            WHEN m.actual_home_score > m.actual_away_score THEN 'home'
            WHEN m.actual_home_score < m.actual_away_score THEN 'away'
            ELSE 'draw'
          END
        ) THEN true
        ELSE false
      END AS outcome_ok,
      CASE
        WHEN pred.sport = 'football'
             AND pred.predicted_home_score = m.actual_home_score
             AND pred.predicted_away_score = m.actual_away_score
          THEN true
        WHEN pred.sport = 'rugby'
             AND (
               CASE
                 WHEN pred.predicted_home_score > pred.predicted_away_score THEN 'home'
                 WHEN pred.predicted_home_score < pred.predicted_away_score THEN 'away'
                 ELSE 'draw'
               END
             ) = (
               CASE
                 WHEN m.actual_home_score > m.actual_away_score THEN 'home'
                 WHEN m.actual_home_score < m.actual_away_score THEN 'away'
                 ELSE 'draw'
               END
             )
             AND abs(
               (pred.predicted_home_score - pred.predicted_away_score)
               - (m.actual_home_score - m.actual_away_score)
             ) = 0
          THEN true
        ELSE false
      END AS perfect_ok
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
      COUNT(*) FILTER (WHERE sport = 'football')::bigint AS settled_predictions_football,
      COUNT(*) FILTER (WHERE sport = 'rugby')::bigint AS settled_predictions_rugby,
      COALESCE(SUM(base_points) FILTER (WHERE sport = 'football'), 0)::bigint AS base_points_football,
      COALESCE(SUM(base_points) FILTER (WHERE sport = 'rugby'), 0)::bigint AS base_points_rugby,
      COUNT(*) FILTER (WHERE sport = 'football' AND perfect_ok)::bigint AS perfect_hits_football,
      COUNT(*) FILTER (WHERE sport = 'rugby' AND perfect_ok)::bigint AS perfect_hits_rugby,
      COUNT(*) FILTER (WHERE sport = 'football' AND outcome_ok)::bigint AS correct_outcomes_football,
      COUNT(*) FILTER (WHERE sport = 'rugby' AND outcome_ok)::bigint AS correct_outcomes_rugby,
      COUNT(*) FILTER (WHERE sport = 'football' AND base_points = 5)::bigint AS hits_exact_football,
      COUNT(*) FILTER (WHERE sport = 'football' AND base_points = 3)::bigint AS hits_close_football,
      COUNT(*) FILTER (WHERE sport = 'football' AND base_points = 1)::bigint AS hits_winner_football,
      COUNT(*) FILTER (WHERE sport = 'football' AND base_points = 0)::bigint AS hits_wrong_football,
      COUNT(*) FILTER (WHERE sport = 'rugby' AND base_points = 5)::bigint AS hits_exact_rugby,
      COUNT(*) FILTER (WHERE sport = 'rugby' AND base_points = 3)::bigint AS hits_close_rugby,
      COUNT(*) FILTER (WHERE sport = 'rugby' AND base_points = 1)::bigint AS hits_winner_rugby,
      COUNT(*) FILTER (WHERE sport = 'rugby' AND base_points = 0)::bigint AS hits_wrong_rugby
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
    a.settled_predictions_football AS predictions_football,
    a.settled_predictions_rugby AS predictions_rugby,
    a.settled_predictions_football,
    a.settled_predictions_rugby,
    a.base_points_football,
    a.base_points_rugby,
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
    0 AS drops_allowed_rugby,
    a.perfect_hits_football,
    a.perfect_hits_rugby,
    a.correct_outcomes_football,
    a.correct_outcomes_rugby,
    a.hits_exact_football,
    a.hits_close_football,
    a.hits_winner_football,
    a.hits_wrong_football,
    a.hits_exact_rugby,
    a.hits_close_rugby,
    a.hits_winner_rugby,
    a.hits_wrong_rugby
  FROM aggregates a
  JOIN public.profiles p ON p.id::text = a.user_id
  WHERE (a.settled_predictions_football + a.settled_predictions_rugby) > 0
  ORDER BY (a.points_football + a.points_rugby) DESC, p.username ASC;
$function$;

ALTER FUNCTION public.get_global_leaderboard_horizon(text, text) SET search_path = public;
ALTER FUNCTION public.get_global_leaderboard_horizon(text, text) SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.get_global_leaderboard_horizon(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_leaderboard_horizon(text, text) TO anon;
