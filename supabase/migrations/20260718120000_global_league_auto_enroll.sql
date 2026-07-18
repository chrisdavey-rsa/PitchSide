-- =============================================================================
-- Phase 1 (New Game Rules): Global PitchSide League + auto-enroll on signup
-- Also: leagues are social groups (competition_id nullable / optional).
-- =============================================================================

-- 1. Allow leagues without a single competition lock.
ALTER TABLE public.leagues
  ALTER COLUMN competition_id DROP NOT NULL;

-- 2. Allow uncapped leagues (NULL max) — required before GLOBAL_LEAGUE insert.
--    Drop NOT NULL on capacity columns, then replace the ≤20 check.
ALTER TABLE public.leagues
  ALTER COLUMN max_players DROP NOT NULL;

ALTER TABLE public.leagues
  ALTER COLUMN max_participants DROP NOT NULL;

ALTER TABLE public.leagues
  DROP CONSTRAINT IF EXISTS leagues_max_players_check;

ALTER TABLE public.leagues
  ADD CONSTRAINT leagues_max_players_check
  CHECK (max_players IS NULL OR (max_players >= 1 AND max_players <= 20));

-- 3. Seed the system Global PitchSide League (idempotent).
INSERT INTO public.leagues (
  id,
  name,
  password,
  competition_id,
  creator_id,
  creator_name,
  is_public,
  is_private,
  max_players,
  max_participants,
  season,
  created_at,
  updated_at
)
VALUES (
  'GLOBAL_LEAGUE',
  'Global PitchSide League',
  '',
  NULL,
  'SYSTEM',
  'PitchSide',
  true,
  false,
  NULL,
  NULL,
  '2026',
  timezone('utc', now()),
  timezone('utc', now())
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  competition_id = NULL,
  is_public = true,
  is_private = false,
  max_players = NULL,
  max_participants = NULL,
  creator_id = 'SYSTEM',
  creator_name = 'PitchSide',
  updated_at = timezone('utc', now());

-- 4. Extend handle_new_user: create profile AND auto-join Global League.
--    NOTE: profiles.dob is DATE in production — always cast metadata text → date.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dob date;
BEGIN
  BEGIN
    v_dob := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'dob'), ''),
      '1990-01-01'
    )::date;
  EXCEPTION
    WHEN invalid_datetime_format OR datetime_field_overflow THEN
      v_dob := DATE '1990-01-01';
  END;

  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    surname,
    username,
    phone,
    dob,
    nationality,
    supported_team,
    preferred_sport,
    is_verified,
    created_at
  )
  VALUES (
    NEW.id::text,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'surname', ''),
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      NEW.raw_user_meta_data->>'nickname',
      split_part(NEW.email, '@', 1)
    ),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    v_dob,
    COALESCE(
      NEW.raw_user_meta_data->>'nationality',
      NEW.raw_user_meta_data->>'country',
      'Global'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'supported_team',
      NEW.raw_user_meta_data->>'supportedTeam',
      'Unknown'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'preferred_sport',
      NEW.raw_user_meta_data->>'preferredSport'
    ),
    (NEW.email_confirmed_at IS NOT NULL),
    timezone('utc', now())
  )
  ON CONFLICT (id) DO UPDATE SET
    email           = EXCLUDED.email,
    first_name      = COALESCE(NULLIF(EXCLUDED.first_name, ''), public.profiles.first_name),
    surname         = COALESCE(NULLIF(EXCLUDED.surname, ''), public.profiles.surname),
    username        = COALESCE(EXCLUDED.username, public.profiles.username),
    phone           = COALESCE(EXCLUDED.phone, public.profiles.phone),
    dob             = COALESCE(EXCLUDED.dob, public.profiles.dob),
    nationality     = COALESCE(EXCLUDED.nationality, public.profiles.nationality),
    supported_team  = COALESCE(EXCLUDED.supported_team, public.profiles.supported_team),
    preferred_sport = COALESCE(EXCLUDED.preferred_sport, public.profiles.preferred_sport),
    is_verified     = EXCLUDED.is_verified;

  -- Auto-enroll every new account into the Global PitchSide League.
  INSERT INTO public.league_members (league_id, user_id, joined_at)
  VALUES ('GLOBAL_LEAGUE', NEW.id::text, timezone('utc', now()))
  ON CONFLICT (league_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Keep triggers wired (idempotent).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Backfill existing players into the Global League.
INSERT INTO public.league_members (league_id, user_id, joined_at)
SELECT 'GLOBAL_LEAGUE', p.id, timezone('utc', now())
FROM public.profiles p
ON CONFLICT (league_id, user_id) DO NOTHING;

COMMENT ON COLUMN public.leagues.competition_id IS
  'Deprecated for new multi-sport social leagues. NULL means all sports/competitions. Legacy rows may still hold a single competition id.';

COMMENT ON COLUMN public.leagues.max_players IS
  'Member cap (1–20) for mini-leagues. NULL = uncapped (e.g. GLOBAL_LEAGUE).';
