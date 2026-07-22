-- Cached API-Sports countries + club teams for the profile team selector.
-- Populated by scripts/seed-teams.ts (not live API calls from the browser).

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('country', 'club')),
  country_code text,
  api_sports_id integer,
  -- Required to scope the profile picker (Football vs Rugby).
  sport text NOT NULL CHECK (sport IN ('football', 'rugby')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  -- Multiple NULLs allowed for api_sports_id (country rows from /countries).
  CONSTRAINT teams_sport_type_api_unique UNIQUE (sport, type, api_sports_id),
  CONSTRAINT teams_sport_type_name_unique UNIQUE (sport, type, name)
);

COMMENT ON TABLE public.teams IS
  'Cached API-Sports countries (type=country) and club sides (type=club) for UI pickers.';
COMMENT ON COLUMN public.teams.country_code IS
  'Lowercase FlagCDN code (e.g. gb-eng, fr, nz). Null when unknown.';
COMMENT ON COLUMN public.teams.api_sports_id IS
  'Upstream API-Sports team id when known; null for country rows sourced from /countries.';

CREATE INDEX IF NOT EXISTS teams_sport_type_name_idx
  ON public.teams (sport, type, name);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Catalog is public read; writes only via service role (seed script / admin).
DROP POLICY IF EXISTS "teams_select_public" ON public.teams;
CREATE POLICY "teams_select_public"
  ON public.teams
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.teams TO anon, authenticated;
GRANT ALL ON public.teams TO service_role;
