-- Sports competitions catalog (API-Sports leagues / cups).
-- Distinct from public.leagues (private social prediction groups).

CREATE TABLE IF NOT EXISTS public.competitions (
  id text PRIMARY KEY,
  api_sports_id integer NOT NULL,
  sport text NOT NULL CHECK (sport IN ('football', 'rugby')),
  name text NOT NULL,
  country text,
  season integer,
  logo_url text,
  type text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT competitions_sport_api_unique UNIQUE (sport, api_sports_id)
);

COMMENT ON TABLE public.competitions IS
  'Cached API-Sports competitions (Premier League, URC, etc.). Not social mini-leagues.';

CREATE INDEX IF NOT EXISTS competitions_sport_idx
  ON public.competitions (sport);
CREATE INDEX IF NOT EXISTS competitions_season_idx
  ON public.competitions (season);
CREATE INDEX IF NOT EXISTS competitions_updated_at_idx
  ON public.competitions (updated_at DESC);

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "competitions_select_public" ON public.competitions;
CREATE POLICY "competitions_select_public"
  ON public.competitions
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.competitions TO anon, authenticated;
GRANT ALL ON public.competitions TO service_role;

-- Link fixtures to cached teams (nullable — keep text names for display).
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS home_team_id uuid REFERENCES public.teams (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS away_team_id uuid REFERENCES public.teams (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_matches_home_team_id
  ON public.matches (home_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_away_team_id
  ON public.matches (away_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_updated_at
  ON public.matches (updated_at DESC);

-- Indexable timestamps on social leagues (unchanged purpose; query helpers).
CREATE INDEX IF NOT EXISTS idx_leagues_created_at
  ON public.leagues (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leagues_updated_at
  ON public.leagues (updated_at DESC);
