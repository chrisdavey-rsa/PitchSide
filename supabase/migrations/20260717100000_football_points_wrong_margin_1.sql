-- PitchSide Football scoring rebalance.
-- Apply in the Supabase SQL Editor after 20260714090000_rugby_points_7_10_brackets.sql.
-- (Self-contained: only redefines the per-prediction football scoring helper.)
--
-- NEW FOOTBALL SCORING BRACKETS
-- Correct outcome is still required first (wrong outcome = 0 points). Then:
--
--   Exact scoreline                    -> 5 points
--   Correct outcome + correct margin   -> 3 points  (wrong scoreline)
--   Correct outcome, wrong margin      -> 1 point   (was 2; e.g. 2–0 vs 1–0)
--   Wrong outcome                      -> 0 points
--
-- Keep in sync with src/utils.ts calculateFootballPoints and
-- supabase/functions/sync-settlement/index.ts.
-- The leaderboard RPC calls this function by name, so redefining it here
-- updates all server-side scoring instantly. Re-settlement of historical
-- predictions.points_won (if stored) may still need a one-off backfill.

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

  RETURN 1;
END;
$$;
