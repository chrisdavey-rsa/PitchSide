-- PitchSide Rugby scoring rebalance.
-- Apply in the Supabase SQL Editor after 20260713130000_leaderboard_best34.sql.
-- (Self-contained: only redefines the per-prediction rugby scoring helper.)
--
-- NEW RUGBY SCORING BRACKETS
-- Correct winner is still required first (wrong outcome = 0 points). Then the
-- absolute difference between the predicted winning margin and the actual
-- winning margin decides the score:
--
--   margin difference = 0  -> 5 points  (exact margin)
--   margin difference <= 7 -> 3 points
--   margin difference <= 10 -> 1 point
--   otherwise              -> 0 points
--
-- This replaces the previous 3 / 5 point brackets. The leaderboard RPC calls
-- this function by name, so redefining it here updates all scoring instantly.

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
  IF margin_difference <= 7 THEN RETURN 3; END IF;
  IF margin_difference <= 10 THEN RETURN 1; END IF;
  RETURN 0;
END;
$$;
