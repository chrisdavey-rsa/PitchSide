-- League privacy + capacity settings for launch.
-- Adds is_private / max_players while keeping legacy is_public / max_participants in sync.

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS max_players integer NOT NULL DEFAULT 20;

-- password already exists on leagues from init schema; ensure nullable text.
ALTER TABLE public.leagues
  ALTER COLUMN password TYPE text;

-- Backfill from legacy columns when present.
UPDATE public.leagues
SET is_private = NOT COALESCE(is_public, true)
WHERE true;

UPDATE public.leagues
SET max_players = LEAST(GREATEST(COALESCE(max_participants, max_players, 20), 1), 20)
WHERE true;

-- Keep legacy columns aligned for older clients / queries.
UPDATE public.leagues
SET is_public = NOT is_private
WHERE true;

UPDATE public.leagues
SET max_participants = max_players
WHERE true;

ALTER TABLE public.leagues
  DROP CONSTRAINT IF EXISTS leagues_max_players_check;

ALTER TABLE public.leagues
  ADD CONSTRAINT leagues_max_players_check
  CHECK (max_players >= 1 AND max_players <= 20);

COMMENT ON COLUMN public.leagues.is_private IS
  'When true, league is hidden from the global directory unless the viewer is already a member.';
COMMENT ON COLUMN public.leagues.max_players IS
  'Hard cap on league membership (1–20).';
COMMENT ON COLUMN public.leagues.password IS
  'Optional join password for private / protected leagues.';
