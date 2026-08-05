-- Account management: ensure is_admin + self-serve delete_user_account()
-- Cascades public data, then removes auth.users (compliance wipe).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_admin IS
  'Admin console + privileged edge functions (admin-broadcast). Never trust client-writable claims.';

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_uid_text text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_uid_text := v_uid::text;

  -- Explicit deletes requested by product (also covered by profiles cascades).
  DELETE FROM public.predictions WHERE user_id = v_uid_text;
  DELETE FROM public.push_subscriptions WHERE user_id = v_uid_text;

  -- Emerging sports tables FK to auth.users without ON DELETE CASCADE.
  IF to_regclass('public.f1_predictions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.f1_predictions WHERE user_id = $1' USING v_uid;
  END IF;
  IF to_regclass('public.golf_predictions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.golf_predictions WHERE user_id = $1' USING v_uid;
  END IF;

  DELETE FROM public.profiles WHERE id = v_uid_text;

  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

COMMENT ON FUNCTION public.delete_user_account() IS
  'Authenticated self-serve account wipe: predictions, push_subscriptions, profiles, then auth.users.';
