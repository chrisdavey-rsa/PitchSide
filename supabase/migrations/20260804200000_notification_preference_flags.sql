-- Notification preference flags used by Account Portal toggles.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.push_enabled IS
  'User opted into 24h unpicked-match Web Push reminders.';
COMMENT ON COLUMN public.profiles.email_enabled IS
  'User opted into the weekly fixture digest email.';

-- Carry forward prior weekly opt-in (defaulted true historically) only when
-- the column exists and was explicitly left on.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'weekly_email_opt_in'
  ) THEN
    EXECUTE $q$
      UPDATE public.profiles
      SET email_enabled = true
      WHERE weekly_email_opt_in IS TRUE
        AND email_enabled IS FALSE
    $q$;
  END IF;
END $$;

-- Anyone who already has a push subscription is treated as opted in.
UPDATE public.profiles p
SET push_enabled = true
WHERE EXISTS (
  SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = p.id
)
AND p.push_enabled IS FALSE;
