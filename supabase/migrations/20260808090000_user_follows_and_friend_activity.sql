-- User follows graph + friend activity notification preference.
-- profiles.id is TEXT (auth.uid()::text) — FKs use text, not uuid.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS friend_activity_opt_in boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.friend_activity_opt_in IS
  'When true (and push_enabled), user wants alerts when followed friends submit picks.';

CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id text NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  following_id text NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_follows_pkey PRIMARY KEY (follower_id, following_id),
  CONSTRAINT user_follows_no_self CHECK (follower_id <> following_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_follows_follower_following_uidx
  ON public.user_follows (follower_id, following_id);

CREATE INDEX IF NOT EXISTS user_follows_following_id_idx
  ON public.user_follows (following_id);

COMMENT ON TABLE public.user_follows IS
  'Directed follow edges. Reciprocal rows mean mutual friends.';

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_follows_select_own" ON public.user_follows;
CREATE POLICY "user_follows_select_own"
  ON public.user_follows
  FOR SELECT
  TO authenticated
  USING (
    follower_id = (auth.uid())::text
    OR following_id = (auth.uid())::text
  );

DROP POLICY IF EXISTS "user_follows_insert_own" ON public.user_follows;
CREATE POLICY "user_follows_insert_own"
  ON public.user_follows
  FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = (auth.uid())::text);

DROP POLICY IF EXISTS "user_follows_delete_own" ON public.user_follows;
CREATE POLICY "user_follows_delete_own"
  ON public.user_follows
  FOR DELETE
  TO authenticated
  USING (follower_id = (auth.uid())::text);

-- Mutual follow for invite signup (SECURITY DEFINER — inserts both directions).
CREATE OR REPLACE FUNCTION public.establish_mutual_follow(p_other_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me text := (auth.uid())::text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_other_user_id IS NULL OR btrim(p_other_user_id) = '' THEN
    RAISE EXCEPTION 'Missing other user id';
  END IF;
  IF p_other_user_id = v_me THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_other_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO public.user_follows (follower_id, following_id)
  VALUES (v_me, p_other_user_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_follows (follower_id, following_id)
  VALUES (p_other_user_id, v_me)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.establish_mutual_follow(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.establish_mutual_follow(text) TO authenticated;

COMMENT ON FUNCTION public.establish_mutual_follow(text) IS
  'After invite signup/join: create reciprocal follow edges between auth.uid() and inviter.';

-- If signup metadata includes invited_by, auto-follow after profile insert.
CREATE OR REPLACE FUNCTION public.handle_new_user_follow_inviter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inviter text;
BEGIN
  v_inviter := nullif(btrim(COALESCE(NEW.raw_user_meta_data->>'invited_by', '')), '');
  IF v_inviter IS NULL OR v_inviter = NEW.id::text THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_inviter) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_follows (follower_id, following_id)
  VALUES (NEW.id::text, v_inviter)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_follows (follower_id, following_id)
  VALUES (v_inviter, NEW.id::text)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_follow_inviter ON auth.users;
CREATE TRIGGER on_auth_user_created_follow_inviter
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_follow_inviter();

-- Keep account wipe explicit for follows (also covered by profiles CASCADE).
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

  DELETE FROM public.user_follows
  WHERE follower_id = v_uid_text OR following_id = v_uid_text;

  DELETE FROM public.predictions WHERE user_id = v_uid_text;
  DELETE FROM public.push_subscriptions WHERE user_id = v_uid_text;

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
