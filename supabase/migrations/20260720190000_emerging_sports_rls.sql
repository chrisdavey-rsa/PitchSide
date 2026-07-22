-- =============================================================================
-- Emerging sports (F1 + Golf) — Row Level Security
-- Secures catalog / calendar tables (public read) and user-owned predictions.
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) ENABLE RLS on all emerging-sports tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.f1_constructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f1_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.golf_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f1_races ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.golf_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.golf_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f1_predictions ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2) PUBLIC READ — static catalog + calendar (anon + authenticated)
-- -----------------------------------------------------------------------------

-- f1_constructors
DROP POLICY IF EXISTS "f1_constructors_select_public" ON public.f1_constructors;
CREATE POLICY "f1_constructors_select_public"
  ON public.f1_constructors
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- f1_drivers
DROP POLICY IF EXISTS "f1_drivers_select_public" ON public.f1_drivers;
CREATE POLICY "f1_drivers_select_public"
  ON public.f1_drivers
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- golf_players
DROP POLICY IF EXISTS "golf_players_select_public" ON public.golf_players;
CREATE POLICY "golf_players_select_public"
  ON public.golf_players
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- f1_races
DROP POLICY IF EXISTS "f1_races_select_public" ON public.f1_races;
CREATE POLICY "f1_races_select_public"
  ON public.f1_races
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- golf_tournaments
DROP POLICY IF EXISTS "golf_tournaments_select_public" ON public.golf_tournaments;
CREATE POLICY "golf_tournaments_select_public"
  ON public.golf_tournaments
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- 3) USER-OWNED — f1_predictions / golf_predictions
-- Optimized auth.uid() pattern: (select auth.uid()) caches per-statement.
-- Requires authenticated session (auth.uid() IS NOT NULL) and own rows only.
-- -----------------------------------------------------------------------------

-- ----- f1_predictions -----
DROP POLICY IF EXISTS "f1_predictions_select_own" ON public.f1_predictions;
CREATE POLICY "f1_predictions_select_own"
  ON public.f1_predictions
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "f1_predictions_insert_own" ON public.f1_predictions;
CREATE POLICY "f1_predictions_insert_own"
  ON public.f1_predictions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "f1_predictions_update_own" ON public.f1_predictions;
CREATE POLICY "f1_predictions_update_own"
  ON public.f1_predictions
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid()) = user_id
  )
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid()) = user_id
  );

-- ----- golf_predictions -----
DROP POLICY IF EXISTS "golf_predictions_select_own" ON public.golf_predictions;
CREATE POLICY "golf_predictions_select_own"
  ON public.golf_predictions
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "golf_predictions_insert_own" ON public.golf_predictions;
CREATE POLICY "golf_predictions_insert_own"
  ON public.golf_predictions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "golf_predictions_update_own" ON public.golf_predictions;
CREATE POLICY "golf_predictions_update_own"
  ON public.golf_predictions
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid()) = user_id
  )
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid()) = user_id
  );

-- Optional indexes for owner lookups (no-op if already present)
CREATE INDEX IF NOT EXISTS idx_f1_predictions_user_id
  ON public.f1_predictions (user_id);

CREATE INDEX IF NOT EXISTS idx_golf_predictions_user_id
  ON public.golf_predictions (user_id);
