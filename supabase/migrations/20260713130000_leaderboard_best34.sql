-- PitchSide dynamic "Drops" forgiveness mechanic for the global leaderboard.
-- Apply manually in Supabase SQL Editor after 20260713120000_leaderboard_rpc.sql.
-- (This file is self-contained and can also be run on its own.)
--
-- WHY THIS EXISTS
-- The previous version hard-coded "best 34 of 38" (drop 4). That math only
-- works for a 38-game league season and breaks for Rugby / knockout cups.
--
-- HOW DROPS ARE NOW DECIDED
-- Each competition has its own drop allowance (drops_allowed). We drop a
-- player's worst results per competition, up to that allowance. There is no
-- longer any hard-coded "34".
--
--   drops_used   = LEAST(drops_allowed, GREATEST(0, settled_games - drops_allowed))
--   best_points  = sum(all settled points) - sum(the worst `drops_used` results)
--   ghost_points = sum(all settled points)  (nothing dropped)
--
-- This guarantees a player always keeps at least `drops_allowed` games before
-- any drop applies, so low-participation players are never zeroed out. For a
-- full 38-game EPL season with a 4-drop allowance this reproduces the old
-- "best 34" behaviour exactly.
--
-- COMPETITION DROP ALLOWANCES
-- PitchSide competitions are defined in code (src/data.ts), not in a database
-- table, so the allowance is mapped here in SQL via pitchside_competition_drops().
-- If a `competitions` table with a `drops_allowed` column is ever introduced,
-- update ONLY that function to read from it.
--
-- Points are computed live from the matches join, so this does NOT depend on
-- the predictions.points_won column.

-- --------------------------------------------------------------------------
-- Per-prediction scoring helpers (idempotent; unchanged from the base file).
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pitchside_football_points(
  predicted_home integer,
  predicted_away integer,
  actual_home integer,
  actual_away integer
) RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  predicted_winner text;
  actual_winner text;
  predicted_margin integer;
  actual_margin integer;
BEGIN
  predicted_winner := CASE
    WHEN predicted_home > predicted_away THEN 'home'
    WHEN predicted_home < predicted_away THEN 'away'
    ELSE 'draw'
  END;
  actual_winner := CASE
    WHEN actual_home > actual_away THEN 'home'
    WHEN actual_home < actual_away THEN 'away'
    ELSE 'draw'
  END;

  IF predicted_winner <> actual_winner THEN
    RETURN 0;
  END IF;

  IF predicted_home = actual_home AND predicted_away = actual_away THEN
    RETURN 5;
  END IF;

  predicted_margin := predicted_home - predicted_away;
  actual_margin := actual_home - actual_away;
  IF predicted_margin = actual_margin THEN
    RETURN 3;
  END IF;

  RETURN 2;
END;
$$;

CREATE OR REPLACE FUNCTION public.pitchside_rugby_points(
  predicted_home integer,
  predicted_away integer,
  actual_home integer,
  actual_away integer
) RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  predicted_winner text;
  actual_winner text;
  predicted_margin integer;
  actual_margin integer;
  margin_difference integer;
BEGIN
  predicted_winner := CASE
    WHEN predicted_home > predicted_away THEN 'home'
    WHEN predicted_home < predicted_away THEN 'away'
    ELSE 'draw'
  END;
  actual_winner := CASE
    WHEN actual_home > actual_away THEN 'home'
    WHEN actual_home < actual_away THEN 'away'
    ELSE 'draw'
  END;

  IF predicted_winner <> actual_winner THEN
    RETURN 0;
  END IF;

  predicted_margin := ABS(predicted_home - predicted_away);
  actual_margin := ABS(actual_home - actual_away);
  margin_difference := ABS(predicted_margin - actual_margin);

  IF margin_difference = 0 THEN RETURN 5; END IF;
  IF margin_difference <= 3 THEN RETURN 3; END IF;
  IF margin_difference <= 5 THEN RETURN 1; END IF;
  RETURN 0;
END;
$$;

-- --------------------------------------------------------------------------
-- Drop allowance per competition.
-- EPL = 4, Championship = 6, everything else (rugby / cups) = 0.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pitchside_competition_drops(p_competition_id text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_competition_id
    WHEN 'f-epl' THEN 4
    WHEN 'f-championship' THEN 6
    ELSE 0
  END;
$$;

-- --------------------------------------------------------------------------
-- Global leaderboard with dynamic per-competition drops.
-- The return signature gains columns, so the old function must be dropped.
-- --------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_global_leaderboard(text);

CREATE OR REPLACE FUNCTION public.get_global_leaderboard(p_current_user_id text DEFAULT NULL)
RETURNS TABLE (
  player_id text,
  nickname text,
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
  -- Total submitted predictions per sport (used for the "Guesses Saved" count).
  prediction_counts AS (
    SELECT
      ap.user_id,
      COUNT(*) FILTER (WHERE ap.sport = 'football') AS predictions_football,
      COUNT(*) FILTER (WHERE ap.sport = 'rugby') AS predictions_rugby
    FROM all_predictions ap
    GROUP BY ap.user_id
  ),
  -- Only settled predictions participate in scoring and drops.
  scored AS (
    SELECT ap.user_id, ap.sport, ap.competition_id, ap.points
    FROM all_predictions ap
    WHERE ap.is_scored
  ),
  -- Per (player, competition): games played, allowance and drops actually used.
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
  -- Rank each settled result within its (player, competition) group, worst first.
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
  -- Sum of the worst `drops_used` results that get excluded per competition.
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
