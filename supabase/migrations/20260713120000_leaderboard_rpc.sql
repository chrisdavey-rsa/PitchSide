-- Server-side leaderboard aggregation for PitchSide (base version, no drops).
-- Apply manually in Supabase SQL Editor.
--
-- Points are computed live from the matches join (predicted vs. actual score).
-- This function does NOT read predictions.points_won, so it works regardless
-- of whether that column has been populated.

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
  is_profile_public boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH scored_predictions AS (
    SELECT
      pred.user_id,
      pred.sport,
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
  aggregated AS (
    SELECT
      sp.user_id,
      COALESCE(SUM(CASE WHEN sp.sport = 'football' THEN sp.points ELSE 0 END), 0) AS points_football,
      COALESCE(SUM(CASE WHEN sp.sport = 'rugby' THEN sp.points ELSE 0 END), 0) AS points_rugby,
      COALESCE(SUM(CASE WHEN sp.sport = 'football' THEN 1 ELSE 0 END), 0) AS predictions_football,
      COALESCE(SUM(CASE WHEN sp.sport = 'rugby' THEN 1 ELSE 0 END), 0) AS predictions_rugby
    FROM scored_predictions sp
    GROUP BY sp.user_id
  )
  SELECT
    p.id AS player_id,
    COALESCE(p.username, 'Contestant') AS nickname,
    COALESCE(p.nationality, 'United Kingdom') AS nationality,
    COALESCE(a.points_football, 0) AS points_football,
    COALESCE(a.points_rugby, 0) AS points_rugby,
    COALESCE(a.predictions_football, 0) AS predictions_football,
    COALESCE(a.predictions_rugby, 0) AS predictions_rugby,
    COALESCE(a.points_football, 0) + COALESCE(a.points_rugby, 0) AS total_points,
    COALESCE(p.is_profile_public, true) AS is_profile_public
  FROM public.profiles p
  LEFT JOIN aggregated a ON a.user_id = p.id
  WHERE p.username IS NOT NULL
    AND p.username NOT LIKE 'freed_nick_%'
  ORDER BY total_points DESC, nickname ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_global_leaderboard(text) TO anon, authenticated;
