-- Include first_name + surname on the global leaderboard RPC so UI rows can
-- show real names under nicknames without a second profiles round-trip.

DROP FUNCTION IF EXISTS public.get_global_leaderboard(text);

CREATE OR REPLACE FUNCTION public.get_global_leaderboard(p_current_user_id text DEFAULT NULL)
RETURNS TABLE (
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
SECURITY INVOKER
AS $$
  WITH all_predictions AS (
    SELECT
      pred.user_id,
      pred.sport,
      COALESCE(m.competition_id, pred.competition_id) AS competition_id,
      (
        m.status = 'completed'
        AND m.actual_home_score IS NOT NULL
        AND m.actual_away_score IS NOT NULL
      ) AS is_scored,
      CASE
        WHEN m.status = 'completed'
          AND m.actual_home_score IS NOT NULL
          AND m.actual_away_score IS NOT NULL
        THEN
          CASE
            WHEN pred.sport = 'football' THEN public.pitchside_football_points(
              pred.predicted_home_score,
              pred.predicted_away_score,
              m.actual_home_score,
              m.actual_away_score
            )
            ELSE public.pitchside_rugby_points(
              pred.predicted_home_score,
              pred.predicted_away_score,
              m.actual_home_score,
              m.actual_away_score
            )
          END
        ELSE 0
      END AS points
    FROM public.predictions pred
    LEFT JOIN public.matches m ON m.id = pred.match_id
    WHERE pred.submitted = true
  ),
  prediction_counts AS (
    SELECT
      ap.user_id,
      COUNT(*) FILTER (WHERE ap.sport = 'football') AS predictions_football,
      COUNT(*) FILTER (WHERE ap.sport = 'rugby') AS predictions_rugby
    FROM all_predictions ap
    GROUP BY ap.user_id
  ),
  scored AS (
    SELECT ap.user_id, ap.sport, ap.competition_id, ap.points
    FROM all_predictions ap
    WHERE ap.is_scored
  ),
  comp_meta AS (
    SELECT
      s.user_id,
      s.sport,
      s.competition_id,
      COUNT(*)::int AS n,
      public.pitchside_competition_drops(s.competition_id) AS drops_allowed,
      LEAST(
        public.pitchside_competition_drops(s.competition_id),
        GREATEST(0, COUNT(*)::int - public.pitchside_competition_drops(s.competition_id))
      ) AS drops_used,
      COALESCE(SUM(s.points), 0) AS ghost_points
    FROM scored s
    GROUP BY s.user_id, s.sport, s.competition_id
  ),
  ranked AS (
    SELECT
      s.user_id,
      s.competition_id,
      s.points,
      ROW_NUMBER() OVER (
        PARTITION BY s.user_id, s.competition_id
        ORDER BY s.points ASC
      ) AS worst_rank
    FROM scored s
  ),
  dropped AS (
    SELECT
      r.user_id,
      r.competition_id,
      COALESCE(SUM(r.points), 0) AS dropped_points
    FROM ranked r
    JOIN comp_meta cm
      ON cm.user_id = r.user_id
     AND cm.competition_id = r.competition_id
    WHERE r.worst_rank <= cm.drops_used
    GROUP BY r.user_id, r.competition_id
  ),
  comp_final AS (
    SELECT
      cm.user_id,
      cm.sport,
      cm.drops_allowed,
      cm.drops_used,
      cm.ghost_points,
      cm.ghost_points - COALESCE(d.dropped_points, 0) AS best_points
    FROM comp_meta cm
    LEFT JOIN dropped d
      ON d.user_id = cm.user_id
     AND d.competition_id = cm.competition_id
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
    COALESCE(sa.drops_allowed_rugby, 0)::int AS drops_allowed_rugby
  FROM public.profiles p
  LEFT JOIN sport_agg sa ON sa.user_id = p.id
  LEFT JOIN prediction_counts pc ON pc.user_id = p.id
  WHERE p.username IS NOT NULL
    AND p.username NOT LIKE 'freed_nick_%'
  ORDER BY total_points DESC, nickname ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_global_leaderboard(text) TO anon, authenticated;
