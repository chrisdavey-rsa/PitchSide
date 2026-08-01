-- Persist API-Sports fixture.id alongside PitchSide match ids (sport-<apiId>).

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS external_fixture_id bigint;

COMMENT ON COLUMN public.matches.external_fixture_id IS
  'Upstream API-Sports fixture.id (football) / game id (rugby).';

-- Backfill from existing composite ids: football-123456 → 123456
UPDATE public.matches
SET external_fixture_id = substring(id from '([0-9]+)$')::bigint
WHERE external_fixture_id IS NULL
  AND id ~ '^[a-z]+-[0-9]+$';

CREATE UNIQUE INDEX IF NOT EXISTS matches_sport_external_fixture_uidx
  ON public.matches (sport, external_fixture_id)
  WHERE external_fixture_id IS NOT NULL;
