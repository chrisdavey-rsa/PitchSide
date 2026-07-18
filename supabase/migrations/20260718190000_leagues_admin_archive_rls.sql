-- Ensure soft-archive works for admin clients (anon/authenticated JWT).
-- PostgREST UPDATE that matches 0 rows (RLS deny) returns no error — so the
-- app must verify .select() after update, and policies must allow admin writes.

-- Column (idempotent if already applied)
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Admin helper (same pattern as matches admin writes)
CREATE OR REPLACE FUNCTION public.is_pitchside_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.is_admin
      FROM public.profiles p
      WHERE p.id = auth.uid()::text
      LIMIT 1
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_pitchside_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pitchside_admin() TO authenticated;

-- Keep broad read for authenticated clients (player browse + admin lists).
DROP POLICY IF EXISTS "Allow raw read for leagues" ON public.leagues;
CREATE POLICY "Allow raw read for leagues"
  ON public.leagues
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Replace wide-open write with: creator OR admin can mutate; anyone authenticated
-- can still create (INSERT) their own leagues via WITH CHECK.
DROP POLICY IF EXISTS "Allow any write for leagues" ON public.leagues;
DROP POLICY IF EXISTS "leagues admin write" ON public.leagues;
DROP POLICY IF EXISTS "leagues creator write" ON public.leagues;
DROP POLICY IF EXISTS "leagues insert authenticated" ON public.leagues;
DROP POLICY IF EXISTS "leagues update by creator or admin" ON public.leagues;
DROP POLICY IF EXISTS "leagues delete by creator or admin" ON public.leagues;

CREATE POLICY "leagues insert authenticated"
  ON public.leagues
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = creator_id OR public.is_pitchside_admin());

CREATE POLICY "leagues update by creator or admin"
  ON public.leagues
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = creator_id OR public.is_pitchside_admin())
  WITH CHECK (auth.uid()::text = creator_id OR public.is_pitchside_admin());

CREATE POLICY "leagues delete by creator or admin"
  ON public.leagues
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = creator_id OR public.is_pitchside_admin());
