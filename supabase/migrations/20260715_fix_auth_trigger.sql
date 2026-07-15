-- =============================================================================
-- 20260715_fix_auth_trigger.sql
-- -----------------------------------------------------------------------------
-- BUG FIX: Registration metadata (preferred_sport, supported_team, nationality,
-- phone, username) was not landing in public.profiles.
--
-- ROOT CAUSE: The previous handle_new_user() trigger read the WRONG metadata
-- keys. The signup client (src/components/AuthFlow.tsx) writes these keys into
-- auth.users.raw_user_meta_data:
--     first_name, surname, username, phone, nationality, dob,
--     supported_team, preferred_sport
-- ...but the old trigger looked for `nickname`, `country`, `supportedTeam` and
-- never read `preferred_sport` at all, so those columns were left empty.
--
-- This migration is fully idempotent (CREATE OR REPLACE FUNCTION, ADD COLUMN
-- IF NOT EXISTS, DROP TRIGGER IF EXISTS) and safe to run on production.
-- =============================================================================

-- 1. Make sure every column the trigger writes to actually exists. -------------
--    (No-ops if they are already present.)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username        TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone           TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nationality     TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS supported_team  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_sport TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified     BOOLEAN DEFAULT false;

-- 2. Recreate the profile-provisioning trigger function. ----------------------
--    Reads the correct metadata keys, with fallbacks for older payloads so no
--    existing client version breaks. SECURITY DEFINER + fixed search_path so it
--    can insert into public.profiles regardless of the caller's role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
      NEW.raw_user_meta_data->>'nickname',           -- legacy key fallback
      split_part(NEW.email, '@', 1)
    ),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'dob', '1990-01-01'),
    COALESCE(
      NEW.raw_user_meta_data->>'nationality',
      NEW.raw_user_meta_data->>'country',            -- legacy key fallback
      'Global'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'supported_team',
      NEW.raw_user_meta_data->>'supportedTeam',      -- legacy key fallback
      'Unknown'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'preferred_sport',
      NEW.raw_user_meta_data->>'preferredSport'      -- legacy key fallback
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

  RETURN NEW;
END;
$$;

-- 3. (Re)wire the triggers on auth.users. -------------------------------------
--    INSERT -> create the profile row on signup.
--    UPDATE of email_confirmed_at -> flip is_verified once the user confirms.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. One-time backfill for users who already registered with the broken trigger.
--    Only fills gaps (NULL / default placeholder values); safe to run repeatedly.
UPDATE public.profiles p
SET
  username        = COALESCE(p.username, u.raw_user_meta_data->>'username', u.raw_user_meta_data->>'nickname'),
  phone           = COALESCE(p.phone, u.raw_user_meta_data->>'phone'),
  nationality     = CASE
                      WHEN p.nationality IS NULL OR p.nationality IN ('', 'Global')
                      THEN COALESCE(u.raw_user_meta_data->>'nationality', u.raw_user_meta_data->>'country', p.nationality)
                      ELSE p.nationality
                    END,
  supported_team  = CASE
                      WHEN p.supported_team IS NULL OR p.supported_team IN ('', 'Unknown')
                      THEN COALESCE(u.raw_user_meta_data->>'supported_team', u.raw_user_meta_data->>'supportedTeam', p.supported_team)
                      ELSE p.supported_team
                    END,
  preferred_sport = COALESCE(p.preferred_sport, u.raw_user_meta_data->>'preferred_sport', u.raw_user_meta_data->>'preferredSport')
FROM auth.users u
WHERE p.id = u.id::text;
