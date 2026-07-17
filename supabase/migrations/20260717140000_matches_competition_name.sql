-- Persist competition display names from schedule sync so the dashboard
-- can derive active competitions without a hardcoded frontend catalog.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS competition_name text;

COMMENT ON COLUMN public.matches.competition_name IS
  'Human-readable competition/league name from the fixtures provider (e.g. Premier League).';
