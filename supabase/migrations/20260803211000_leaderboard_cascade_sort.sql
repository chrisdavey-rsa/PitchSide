-- Cascading sort for global leaderboards (points → Perfect Predictions → Strike Rate → username).
-- Uses table-qualified expressions (SELECT aliases cannot appear inside ORDER BY expressions).

DO $patch$
DECLARE
  def text;
  old_season text := 'ORDER BY total_points DESC, nickname ASC';
  new_season text := $ord$ORDER BY
    (COALESCE(sa.points_football, 0) + COALESCE(sa.points_rugby, 0)) DESC,
    (COALESCE(hc.perfect_hits_football, 0) + COALESCE(hc.perfect_hits_rugby, 0)) DESC,
    CASE
      WHEN (COALESCE(hc.settled_predictions_football, 0) + COALESCE(hc.settled_predictions_rugby, 0)) > 0
      THEN (COALESCE(sa.points_football, 0) + COALESCE(sa.points_rugby, 0))::numeric
           / (COALESCE(hc.settled_predictions_football, 0) + COALESCE(hc.settled_predictions_rugby, 0))
      ELSE 0::numeric
    END DESC,
    COALESCE(p.username, 'Contestant') ASC$ord$;
  old_horizon text := 'ORDER BY (a.points_football + a.points_rugby) DESC, p.username ASC';
  new_horizon text := $ord$ORDER BY
    (a.points_football + a.points_rugby) DESC,
    (a.perfect_hits_football + a.perfect_hits_rugby) DESC,
    CASE
      WHEN (a.settled_predictions_football + a.settled_predictions_rugby) > 0
      THEN (a.points_football + a.points_rugby)::numeric
           / (a.settled_predictions_football + a.settled_predictions_rugby)
      ELSE 0::numeric
    END DESC,
    p.username ASC$ord$;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_global_leaderboard';
  IF def IS NOT NULL AND position(old_season IN def) > 0 THEN
    EXECUTE replace(def, old_season, new_season);
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_global_leaderboard_horizon';
  IF def IS NOT NULL AND position(old_horizon IN def) > 0 THEN
    EXECUTE replace(def, old_horizon, new_horizon);
  END IF;
END;
$patch$;
