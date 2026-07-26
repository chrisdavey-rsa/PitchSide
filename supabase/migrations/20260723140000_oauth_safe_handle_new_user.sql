-- =============================================================================
-- OAuth-safe handle_new_user: allow NULL country / empty selected_sports
-- so post-login OnboardingFlow can collect missing preferences.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dob date;
  v_nationality text;
  v_supported_team text;
  v_preferred_sport text;
  v_selected_sports jsonb;
  v_meta_sports jsonb;
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

  -- OAuth providers often omit these — leave NULL / empty for onboarding.
  v_nationality := NULLIF(
    TRIM(
      COALESCE(
        NEW.raw_user_meta_data->>'nationality',
        NEW.raw_user_meta_data->>'country',
        ''
      )
    ),
    ''
  );

  v_supported_team := NULLIF(
    TRIM(
      COALESCE(
        NEW.raw_user_meta_data->>'supported_team',
        NEW.raw_user_meta_data->>'supportedTeam',
        ''
      )
    ),
    ''
  );

  v_preferred_sport := NULLIF(
    TRIM(
      COALESCE(
        NEW.raw_user_meta_data->>'preferred_sport',
        NEW.raw_user_meta_data->>'preferredSport',
        ''
      )
    ),
    ''
  );

  -- Prefer explicit selected_sports JSON from signup metadata.
  BEGIN
    v_meta_sports := NEW.raw_user_meta_data->'selected_sports';
  EXCEPTION
    WHEN OTHERS THEN
      v_meta_sports := NULL;
  END;

  IF v_meta_sports IS NOT NULL AND jsonb_typeof(v_meta_sports) = 'array' THEN
    v_selected_sports := v_meta_sports;
  ELSIF v_preferred_sport IS NOT NULL THEN
    v_selected_sports := jsonb_build_array(v_preferred_sport);
  ELSE
    -- OAuth / incomplete signup → empty array triggers client onboarding gate.
    v_selected_sports := '[]'::jsonb;
  END IF;

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
    selected_sports,
    favorite_f1_team,
    favorite_golfer,
    is_verified,
    created_at
  )
  VALUES (
    NEW.id::text,
    NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(COALESCE(NEW.email, 'player'), '@', 1)
    ),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'surname'), ''), ''),
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'nickname'), ''),
      split_part(COALESCE(NEW.email, 'player'), '@', 1)
    ),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    v_dob,
    v_nationality,
    v_supported_team,
    v_preferred_sport,
    v_selected_sports,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'favorite_f1_team', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'favorite_golfer', '')), ''),
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
    -- Only fill blanks — never overwrite an onboarding-completed profile.
    nationality     = COALESCE(public.profiles.nationality, EXCLUDED.nationality),
    supported_team  = COALESCE(public.profiles.supported_team, EXCLUDED.supported_team),
    preferred_sport = COALESCE(public.profiles.preferred_sport, EXCLUDED.preferred_sport),
    selected_sports = CASE
      WHEN public.profiles.selected_sports IS NULL
        OR public.profiles.selected_sports = '[]'::jsonb
      THEN EXCLUDED.selected_sports
      ELSE public.profiles.selected_sports
    END,
    favorite_f1_team = COALESCE(public.profiles.favorite_f1_team, EXCLUDED.favorite_f1_team),
    favorite_golfer  = COALESCE(public.profiles.favorite_golfer, EXCLUDED.favorite_golfer),
    is_verified     = EXCLUDED.is_verified;

  INSERT INTO public.league_members (league_id, user_id, joined_at)
  VALUES ('GLOBAL_LEAGUE', NEW.id::text, timezone('utc', now()))
  ON CONFLICT (league_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates profiles for email + OAuth signups. Missing country/sports stay NULL/[] for OnboardingFlow.';

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
