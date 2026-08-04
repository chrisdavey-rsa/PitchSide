-- League member predictions (SECURITY DEFINER bypasses own-row RLS for peers)
-- + Perfect Hits / Outcome Success on get_global_leaderboard.

-- -----------------------------------------------------------------------------
-- 1) League fixture comparison: submitted picks for members of a league
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_league_member_predictions(
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
  kickoff_time timestamptz
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
    pred.points_won,
    m.kickoff_time
  FROM public.predictions pred
  JOIN public.matches m ON m.id = pred.match_id
  JOIN public.league_members lm
    ON lm.league_id = p_league_id
   AND lm.user_id = pred.user_id
  WHERE pred.submitted = true
    AND m.kickoff_time >= p_since
  ORDER BY m.kickoff_time ASC, pred.user_id ASC;
END;
$function$;

ALTER FUNCTION public.get_league_member_predictions(text, timestamptz) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_league_member_predictions(text, timestamptz) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2) Global leaderboard: add perfect_hits + correct_outcomes per sport
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
  correct_outcomes_rugby bigint
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
      COUNT(*) FILTER (WHERE sport = 'football' AND perfect_ok) AS perfect_hits_football,
      COUNT(*) FILTER (WHERE sport = 'rugby' AND perfect_ok) AS perfect_hits_rugby,
      COUNT(*) FILTER (WHERE sport = 'football' AND outcome_ok) AS correct_outcomes_football,
      COUNT(*) FILTER (WHERE sport = 'rugby' AND outcome_ok) AS correct_outcomes_rugby
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
    COALESCE(hc.correct_outcomes_rugby, 0) AS correct_outcomes_rugby
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
