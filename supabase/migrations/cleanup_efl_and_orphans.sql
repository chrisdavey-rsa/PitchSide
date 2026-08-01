-- Alias of 20260801120000_cleanup_efl_and_orphans.sql for discoverability.
-- Prefer the timestamped migration for apply order.

-- Remove EFL Cup (API-Sports league 48) fixtures + catalog row.
-- Force-finish orphaned "ghost" matches stuck live/upcoming past 7 days.

DELETE FROM public.predictions
WHERE match_id IN (
  SELECT m.id
  FROM public.matches m
  WHERE m.competition_id = 'f-eflcup'
     OR m.competition_id ILIKE '%efl%cup%'
);

DELETE FROM public.matches
WHERE competition_id = 'f-eflcup'
   OR competition_id ILIKE '%efl%cup%';

DELETE FROM public.competitions
WHERE id = 'f-eflcup'
   OR api_sports_id = 48;

UPDATE public.matches
SET
  status = 'completed',
  updated_at = timezone('utc', now())
WHERE kickoff_time < (timezone('utc', now()) - INTERVAL '7 days')
  AND status IS DISTINCT FROM 'completed';
