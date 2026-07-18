-- =============================================================================
-- Fix signup 500: handle_new_user dob type mismatch (42804)
-- -----------------------------------------------------------------------------
-- Production profiles.dob is DATE, but the trigger inserted TEXT from
-- raw_user_meta_data->>'dob'. That aborts the auth.users transaction
-- (cascading 25P02 / DEALLOCATE noise).
--
-- Also keeps GLOBAL_LEAGUE auto-enroll after a successful profiles upsert.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dob date;
BEGIN
  -- Cast metadata DOB safely (empty / invalid → default).
  BEGIN
    v_dob := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'dob'), ''),
      '1990-01-01'
    )::date;
  EXCEPTION
    WHEN invalid_datetime_format OR datetime_field_overflow THEN
      v_dob := DATE '1990-01-01';
  END;

  -- 1) Profile first (must succeed before league membership).
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

  -- 2) Auto-enroll into Global PitchSide League (idempotent).
  INSERT INTO public.league_members (league_id, user_id, joined_at)
  VALUES ('GLOBAL_LEAGUE', NEW.id::text, timezone('utc', now()))
  ON CONFLICT (league_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
