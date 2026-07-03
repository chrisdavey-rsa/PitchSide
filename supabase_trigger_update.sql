-- This replaces the existing trigger function to ensure the profile is created 
-- or updated with the email verification status.

-- Update the profiles table schema to include email_confirmed_at if it isn't there already.
-- (This assumes your frontend maps is_verified boolean or emailConfirmedAt)
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_confirmed_at timestamp with time zone;

-- Ensure the function syncs the email_confirmed_at.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email,
    first_name, 
    surname, 
    nickname, 
    username,
    dob, 
    country, 
    nationality, 
    supported_team, 
    is_verified, -- boolean flag for backward compatibility
    email_confirmed_at -- new timestamp
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'surname', ''),
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'dob', '1990-01-01'),
    COALESCE(NEW.raw_user_meta_data->>'country', 'Global'),
    COALESCE(NEW.raw_user_meta_data->>'country', 'Global'),
    COALESCE(NEW.raw_user_meta_data->>'supportedTeam', 'Unknown'),
    (NEW.email_confirmed_at IS NOT NULL),
    NEW.email_confirmed_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    is_verified = (NEW.email_confirmed_at IS NOT NULL),
    email_confirmed_at = NEW.email_confirmed_at;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- If you want to sync existing profiles that missed the trigger:
-- UPDATE public.profiles p
-- SET is_verified = (u.email_confirmed_at IS NOT NULL),
--     email_confirmed_at = u.email_confirmed_at
-- FROM auth.users u
-- WHERE p.id = u.id;
