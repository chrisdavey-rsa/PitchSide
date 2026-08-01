-- Align profiles + handle_new_user with 13+ age gate and Terms/Privacy consent.
-- Frontend signup sends: age_confirmed_13, terms_accepted (raw_user_meta_data).
-- Keeps backward compatibility with legacy age_confirmed_16.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_confirmed_13 boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz NULL;

COMMENT ON COLUMN public.profiles.age_confirmed_13 IS
  'True when the user confirmed they are 13 years of age or older at signup.';
COMMENT ON COLUMN public.profiles.terms_accepted_at IS
  'UTC timestamp when the user accepted the Terms of Service.';
COMMENT ON COLUMN public.profiles.privacy_accepted_at IS
  'UTC timestamp when the user accepted the Privacy Policy.';

-- Existing players pre-date the explicit checkboxes; treat as grandfathered.
UPDATE public.profiles
SET
  age_confirmed_13 = true,
  terms_accepted_at = COALESCE(terms_accepted_at, created_at, timezone('utc', now())),
  privacy_accepted_at = COALESCE(privacy_accepted_at, created_at, timezone('utc', now()))
WHERE age_confirmed_13 = false
   OR terms_accepted_at IS NULL
   OR privacy_accepted_at IS NULL;

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
  v_terms_accepted boolean;
  v_space int;
  v_global_league_id text;
  v_consent_at timestamptz;
BEGIN
  -- Prefer 13+ flag; fall back to legacy 16+ checkbox metadata.
  v_age_confirmed := COALESCE(
    (NEW.raw_user_meta_data->>'age_confirmed_13')::boolean,
    (NEW.raw_user_meta_data->>'age_confirmed_16')::boolean,
    false
  );

  v_terms_accepted := COALESCE(
    (NEW.raw_user_meta_data->>'terms_accepted')::boolean,
    (NEW.raw_user_meta_data->>'agreed_to_terms')::boolean,
    false
  );

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

  v_consent_at := CASE WHEN v_terms_accepted THEN timezone('utc', now()) ELSE NULL END;

  INSERT INTO public.profiles (
    id, email, first_name, surname, username, phone, dob,
    nationality, supported_team, preferred_sport, selected_sports,
    favorite_f1_team, favorite_golfer, is_verified, created_at,
    age_confirmed_13, terms_accepted_at, privacy_accepted_at
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
    timezone('utc', now()),
    v_age_confirmed,
    v_consent_at,
    v_consent_at
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
    is_verified     = EXCLUDED.is_verified,
    age_confirmed_13 = public.profiles.age_confirmed_13 OR EXCLUDED.age_confirmed_13,
    terms_accepted_at = COALESCE(public.profiles.terms_accepted_at, EXCLUDED.terms_accepted_at),
    privacy_accepted_at = COALESCE(public.profiles.privacy_accepted_at, EXCLUDED.privacy_accepted_at);

  SELECT COALESCE(
    (
      SELECT ss.global_league_id
      FROM public.sport_seasons ss
      WHERE ss.is_active = true
        AND ss.global_league_id IS NOT NULL
      ORDER BY ss.updated_at DESC
      LIMIT 1
    ),
    'GLOBAL_LEAGUE'
  ) INTO v_global_league_id;

  INSERT INTO public.league_members (league_id, user_id, joined_at)
  VALUES (v_global_league_id, NEW.id::text, timezone('utc', now()))
  ON CONFLICT (league_id, user_id) DO NOTHING;

  IF v_global_league_id IS DISTINCT FROM 'GLOBAL_LEAGUE' THEN
    INSERT INTO public.league_members (league_id, user_id, joined_at)
    VALUES ('GLOBAL_LEAGUE', NEW.id::text, timezone('utc', now()))
    ON CONFLICT (league_id, user_id) DO NOTHING;
  END IF;

  PERFORM public.grant_baseline_double_bubble(NEW.id::text);

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates profiles for email + OAuth. Stores age_confirmed_13 and Terms/Privacy acceptance timestamps from signup metadata.';

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
