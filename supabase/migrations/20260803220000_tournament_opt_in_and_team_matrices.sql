-- Tournament opt-in prefs, PitchSide Picks flag, and team seed matrices.

CREATE TYPE public.golf_coverage_tier AS ENUM (
  'MAJORS_ONLY',
  'MAJORS_TEAMS',
  'MAJORS_MARQUEE',
  'ALL_PGA'
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscribed_leagues text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS golf_coverage_tier public.golf_coverage_tier NOT NULL DEFAULT 'MAJORS_ONLY',
  ADD COLUMN IF NOT EXISTS preferred_nation text;

COMMENT ON COLUMN public.profiles.subscribed_leagues IS
  'Competition IDs the user has opted into (e.g. f-epl, r-sixnations, g-majors).';
COMMENT ON COLUMN public.profiles.golf_coverage_tier IS
  'Golf feed depth: majors → team events → marquee → full PGA.';
COMMENT ON COLUMN public.profiles.preferred_nation IS
  'ISO 3166-1 alpha-2 (or common rugby codes ZA/NZ/AU/AR) for auto-subscription.';

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS is_pitchside_pick boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_matches_pitchside_pick
  ON public.matches (is_pitchside_pick)
  WHERE is_pitchside_pick = true;

CREATE INDEX IF NOT EXISTS idx_profiles_subscribed_leagues
  ON public.profiles USING GIN (subscribed_leagues);

-- ---------------------------------------------------------------------------
-- Preeminent / PitchSide Picks team matrices (seed constants)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.preeminent_teams (
  id bigserial PRIMARY KEY,
  sport text NOT NULL CHECK (sport IN ('football', 'rugby')),
  region text NOT NULL,
  team_name text NOT NULL,
  UNIQUE (sport, region, team_name)
);

CREATE TABLE IF NOT EXISTS public.pitchside_picks_teams (
  id bigserial PRIMARY KEY,
  sport text NOT NULL CHECK (sport IN ('football', 'rugby')),
  team_name text NOT NULL,
  UNIQUE (sport, team_name)
);

ALTER TABLE public.preeminent_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitchside_picks_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "preeminent_teams_read" ON public.preeminent_teams;
CREATE POLICY "preeminent_teams_read"
  ON public.preeminent_teams FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "pitchside_picks_teams_read" ON public.pitchside_picks_teams;
CREATE POLICY "pitchside_picks_teams_read"
  ON public.pitchside_picks_teams FOR SELECT TO authenticated, anon USING (true);

INSERT INTO public.preeminent_teams (sport, region, team_name) VALUES
  -- Football UK
  ('football', 'UK', 'Manchester City'),
  ('football', 'UK', 'Arsenal'),
  ('football', 'UK', 'Liverpool'),
  ('football', 'UK', 'Manchester United'),
  ('football', 'UK', 'Chelsea'),
  ('football', 'UK', 'Tottenham'),
  -- Football Spain
  ('football', 'Spain', 'Real Madrid'),
  ('football', 'Spain', 'Barcelona'),
  ('football', 'Spain', 'Atlético Madrid'),
  ('football', 'Spain', 'Sevilla'),
  ('football', 'Spain', 'Valencia'),
  ('football', 'Spain', 'Villarreal'),
  ('football', 'Spain', 'Real Sociedad'),
  -- Football Italy
  ('football', 'Italy', 'Inter Milan'),
  ('football', 'Italy', 'AC Milan'),
  ('football', 'Italy', 'Juventus'),
  ('football', 'Italy', 'Roma'),
  ('football', 'Italy', 'Napoli'),
  ('football', 'Italy', 'Atalanta'),
  -- Football Germany
  ('football', 'Germany', 'Bayern Munich'),
  ('football', 'Germany', 'Borussia Dortmund'),
  ('football', 'Germany', 'RB Leipzig'),
  ('football', 'Germany', 'Bayer Leverkusen'),
  -- Football France
  ('football', 'France', 'PSG'),
  ('football', 'France', 'Paris Saint Germain'),
  ('football', 'France', 'AS Monaco'),
  ('football', 'France', 'Lille'),
  ('football', 'France', 'Marseille'),
  ('football', 'France', 'Olympique Lyonnais'),
  -- Rugby Premiership
  ('rugby', 'Premiership', 'Saracens'),
  ('rugby', 'Premiership', 'Leicester Tigers'),
  ('rugby', 'Premiership', 'Northampton Saints'),
  ('rugby', 'Premiership', 'Sale Sharks'),
  ('rugby', 'Premiership', 'Harlequins'),
  ('rugby', 'Premiership', 'Bath Rugby'),
  -- Rugby Top 14
  ('rugby', 'Top14', 'Stade Toulousain'),
  ('rugby', 'Top14', 'Stade Rochelais'),
  ('rugby', 'Top14', 'Racing 92'),
  ('rugby', 'Top14', 'Stade Français'),
  ('rugby', 'Top14', 'Union Bordeaux Bègles'),
  -- Rugby URC
  ('rugby', 'URC', 'Leinster'),
  ('rugby', 'URC', 'Munster Rugby'),
  ('rugby', 'URC', 'Bulls'),
  ('rugby', 'URC', 'Stormers'),
  ('rugby', 'URC', 'Glasgow Warriors'),
  ('rugby', 'URC', 'Ulster Rugby'),
  ('rugby', 'URC', 'Sharks'),
  -- Rugby Nations
  ('rugby', 'SixNations', 'England'),
  ('rugby', 'SixNations', 'Ireland'),
  ('rugby', 'SixNations', 'Wales'),
  ('rugby', 'SixNations', 'Scotland'),
  ('rugby', 'SixNations', 'France'),
  ('rugby', 'SixNations', 'Italy'),
  ('rugby', 'RugbyChampionship', 'South Africa'),
  ('rugby', 'RugbyChampionship', 'New Zealand'),
  ('rugby', 'RugbyChampionship', 'Australia'),
  ('rugby', 'RugbyChampionship', 'Argentina')
ON CONFLICT DO NOTHING;

INSERT INTO public.pitchside_picks_teams (sport, team_name) VALUES
  ('football', 'Manchester City'),
  ('football', 'Liverpool'),
  ('football', 'Barcelona'),
  ('football', 'Real Madrid'),
  ('football', 'PSG'),
  ('football', 'Paris Saint Germain'),
  ('football', 'Arsenal'),
  ('football', 'Borussia Dortmund'),
  ('football', 'Bayern Munich'),
  ('rugby', 'South Africa'),
  ('rugby', 'New Zealand'),
  ('rugby', 'England'),
  ('rugby', 'France'),
  ('rugby', 'Ireland')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Auto-subscription helper (onboarding / profile init)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pitchside_default_subscribed_leagues(
  p_preferred_nation text DEFAULT NULL,
  p_selected_sports jsonb DEFAULT '[]'::jsonb
)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  v_nation text := upper(trim(coalesce(p_preferred_nation, '')));
  v_leagues text[] := ARRAY[]::text[];
  v_sports text[];
  v_has_football boolean := false;
  v_has_rugby boolean := false;
  v_has_golf boolean := false;
BEGIN
  SELECT coalesce(array_agg(lower(value::text)), ARRAY[]::text[])
  INTO v_sports
  FROM jsonb_array_elements_text(coalesce(p_selected_sports, '[]'::jsonb)) AS t(value);

  v_has_football := 'football' = ANY (v_sports) OR cardinality(v_sports) = 0;
  v_has_rugby := 'rugby' = ANY (v_sports) OR cardinality(v_sports) = 0;
  v_has_golf := 'golf' = ANY (v_sports);

  IF v_has_football THEN
    v_leagues := array_append(v_leagues, 'f-epl');
  END IF;

  IF v_has_rugby THEN
    IF v_nation IN ('ZA', 'NZ', 'AU', 'AR') THEN
      v_leagues := v_leagues || ARRAY['r-championship', 'r-nations'];
    ELSE
      v_leagues := array_append(v_leagues, 'r-sixnations');
    END IF;
  END IF;

  IF v_has_golf THEN
    v_leagues := array_append(v_leagues, 'g-majors');
  END IF;

  RETURN v_leagues;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pitchside_apply_tournament_defaults(
  p_user_id text,
  p_preferred_nation text DEFAULT NULL,
  p_selected_sports jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_nation text;
  v_sports jsonb;
  v_leagues text[];
BEGIN
  IF auth.uid() IS NULL OR auth.uid()::text <> p_user_id THEN
    IF NOT public.is_pitchside_admin() THEN
      RAISE EXCEPTION 'not allowed';
    END IF;
  END IF;

  SELECT
    coalesce(nullif(trim(p_preferred_nation), ''), preferred_nation, nationality),
    coalesce(p_selected_sports, selected_sports, '[]'::jsonb)
  INTO v_nation, v_sports
  FROM public.profiles
  WHERE id = p_user_id;

  v_leagues := public.pitchside_default_subscribed_leagues(v_nation, v_sports);

  UPDATE public.profiles
  SET
    preferred_nation = coalesce(nullif(trim(p_preferred_nation), ''), preferred_nation),
    subscribed_leagues = CASE
      WHEN coalesce(array_length(subscribed_leagues, 1), 0) = 0 THEN v_leagues
      ELSE subscribed_leagues
    END,
    golf_coverage_tier = coalesce(golf_coverage_tier, 'MAJORS_ONLY')
  WHERE id = p_user_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.pitchside_default_subscribed_leagues(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pitchside_apply_tournament_defaults(text, text, jsonb) TO authenticated;

-- Backfill existing users with empty subscriptions.
UPDATE public.profiles
SET subscribed_leagues = public.pitchside_default_subscribed_leagues(
  preferred_nation,
  coalesce(selected_sports, '["football","rugby"]'::jsonb)
)
WHERE coalesce(array_length(subscribed_leagues, 1), 0) = 0;

-- Opt-in competitions missing from catalog (EFL Cup + Serie A).
INSERT INTO public.competitions (id, api_sports_id, sport, name, country)
VALUES
  ('f-eflcup', 48, 'football', 'EFL Cup', 'England'),
  ('f-seriea', 135, 'football', 'Serie A', 'Italy')
ON CONFLICT (id) DO UPDATE
SET
  api_sports_id = EXCLUDED.api_sports_id,
  name = EXCLUDED.name,
  country = EXCLUDED.country,
  updated_at = now();
