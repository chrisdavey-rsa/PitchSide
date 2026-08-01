-- Purge obsolete historic fixtures (pre-2025) and orphaned predictions.
-- Keeps the matches table focused on current-season / recent play.

-- Clear prediction rows tied to obsolete fixtures first (no FK on match_id).
DELETE FROM public.predictions
WHERE match_id IN (
  SELECT id
  FROM public.matches
  WHERE kickoff_time < '2025-01-01 00:00:00+00'
);

-- Detach any power-up applications pointing at obsolete fixtures.
UPDATE public.user_powerups
SET applied_fixture_id = NULL
WHERE applied_fixture_id IN (
  SELECT id
  FROM public.matches
  WHERE kickoff_time < '2025-01-01 00:00:00+00'
);

DELETE FROM public.matches
WHERE kickoff_time < '2025-01-01 00:00:00+00';
