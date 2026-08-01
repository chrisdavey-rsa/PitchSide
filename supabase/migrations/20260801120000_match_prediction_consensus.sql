-- Public consensus stats for a fixture (submitted picks only).
-- SECURITY DEFINER so clients can read aggregates without per-row prediction access.

CREATE OR REPLACE FUNCTION public.get_match_prediction_consensus(p_match_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*)::int,
    'home', COUNT(*) FILTER (
      WHERE p.predicted_home_score > p.predicted_away_score
    )::int,
    'draw', COUNT(*) FILTER (
      WHERE p.predicted_home_score = p.predicted_away_score
    )::int,
    'away', COUNT(*) FILTER (
      WHERE p.predicted_home_score < p.predicted_away_score
    )::int
  )
  FROM public.predictions p
  WHERE p.match_id = p_match_id
    AND p.submitted IS TRUE;
$$;

REVOKE ALL ON FUNCTION public.get_match_prediction_consensus(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_match_prediction_consensus(text) TO authenticated, anon;
