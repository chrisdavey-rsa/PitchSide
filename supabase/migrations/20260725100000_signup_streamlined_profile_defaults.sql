-- Align signup metadata with streamlined Create Account form.
-- - Accept full_name → first_name + surname split
-- - Allow NULL dob when age_confirmed_16 is true (checkbox replaces DOB picker)
-- - Phone remains optional (NULL when empty)
-- Safe to re-run.

ALTER TABLE public.profiles
  ALTER COLUMN dob DROP NOT NULL;

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
  v_full_name text;
  v_first_name text;
  v_surname text;
  v_age_confirmed boolean;
  v_space int;
BEGIN
  v_age_confirmed := COALESCE(
    (NEW.raw_user_meta_data->>'age_confirmed_16')::boolean,
    false
  );

  -- DOB: optional. Age checkbox alone is enough for signup.
  IF v_age_confirmed
     AND NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'dob', '')), '') IS NULL THEN
    v_dob := NULL;
  ELSE
    BEGIN
      v_dob := NULLIF(TRIM(NEW.raw_user_meta_data->>'dob'), '')::date;
    EXCEPTION
      WHEN invalid_datetime_format OR datetime_field_overflow THEN
        v_dob := NULL;
    END;
  END IF;

  v_nationality := NULLIF(
    TRIM(COALESCE(
      NEW.raw_user_meta_data->>'nationality',
      NEW.raw_user_meta_data->>'country',
      ''
    )),
    ''
  );

  v_supported_team := NULLIF(
    TRIM(COALESCE(
      NEW.raw_user_meta_data->>'supported_team',
      NEW.raw_user_meta_data->>'supportedTeam',
      ''
    )),
    ''
  );

  v_preferred_sport := NULLIF(
    TRIM(COALESCE(
      NEW.raw_user_meta_data->>'preferred_sport',
      NEW.raw_user_meta_data->>'preferredSport',
      ''
    )),
    ''
  );

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
    v_selected_sports := '[]'::jsonb;
  END IF;

  -- Prefer explicit first/surname; else split full_name; else email local-part.
  v_full_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');
  v_first_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
  v_surname := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'surname'), ''), '');

  IF v_first_name IS NULL AND v_full_name IS NOT NULL THEN
    v_space := position(' ' in v_full_name);
    IF v_space > 0 THEN
      v_first_name := left(v_full_name, v_space - 1);
      v_surname := COALESCE(NULLIF(trim(substr(v_full_name, v_space + 1)), ''), '');
    ELSE
      v_first_name := v_full_name;
      v_surname := '';
    END IF;
  END IF;

  IF v_first_name IS NULL OR v_first_name = '' THEN
    v_first_name := split_part(COALESCE(NEW.email, 'player'), '@', 1);
  END IF;

  INSERT INTO public.profiles (
    id, email, first_name, surname, username, phone, dob,
    nationality, supported_team, preferred_sport, selected_sports,
    favorite_f1_team, favorite_golfer, is_verified, created_at
  )
  VALUES (
    NEW.id::text,
    NEW.email,
    v_first_name,
    v_surname,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'nickname'), ''),
      split_part(COALESCE(NEW.email, 'player'), '@', 1)
    ),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
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
  'Creates profiles for email + Google OAuth. Accepts full_name, optional phone/dob, age_confirmed_16.';

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
