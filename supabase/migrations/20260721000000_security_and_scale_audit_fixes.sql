-- =============================================================================
-- Security & scale audit fixes (C1–C4, H1–H2, M1, M3–M4, L1)
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) RPC EXECUTE REVOKES (C4, M1, H2)
-- -----------------------------------------------------------------------------

-- Quota ledger: service_role only (Edge Functions).
REVOKE ALL ON FUNCTION public.reserve_api_quota(date, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_api_quota(date, text, integer, text) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_api_quota(date, text, integer, text) FROM authenticated;

REVOKE ALL ON FUNCTION public.record_api_quota_headers(date, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_api_quota_headers(date, text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.record_api_quota_headers(date, text, integer, integer) FROM authenticated;

-- League helpers: authenticated only (functions already enforce auth.uid()).
REVOKE ALL ON FUNCTION public.get_league_password(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_league_password(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_league_password(text) TO authenticated;

REVOKE ALL ON FUNCTION public.join_league_secure(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_league_secure(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_league_secure(text, text, text) TO authenticated;

-- Trigger / event-trigger helpers: not callable via PostgREST.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM authenticated;

-- Used inside RLS policies for authenticated writers — keep authenticated EXECUTE.
REVOKE ALL ON FUNCTION public.is_pitchside_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_pitchside_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_pitchside_admin() TO authenticated;

-- Nickname → email lookup: no anonymous enumeration via RPC.
-- NOTE: nickname login before auth currently calls this as anon; after this
-- migration that path must use email login or a dedicated rate-limited Auth flow.
REVOKE ALL ON FUNCTION public.get_email_by_nickname(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_email_by_nickname(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_nickname(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2) PREDICTIONS — competitive integrity (C3) + initplan (M3)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read predictions" ON public.predictions;
DROP POLICY IF EXISTS "Allow raw read for predictions" ON public.predictions;
DROP POLICY IF EXISTS "Users can insert own predictions" ON public.predictions;
DROP POLICY IF EXISTS "Users can update own predictions" ON public.predictions;
DROP POLICY IF EXISTS "predictions_select_own" ON public.predictions;
DROP POLICY IF EXISTS "predictions_insert_own" ON public.predictions;
DROP POLICY IF EXISTS "predictions_update_own" ON public.predictions;

CREATE POLICY "predictions_select_own"
  ON public.predictions
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid())::text = user_id
  );

CREATE POLICY "predictions_insert_own"
  ON public.predictions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid())::text = user_id
  );

CREATE POLICY "predictions_update_own"
  ON public.predictions
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid())::text = user_id
  )
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid())::text = user_id
  );

-- -----------------------------------------------------------------------------
-- 3) PROFILES & LEAGUES — PII / secrets (C1, C2)
--
-- Strategy:
--   • Base table RLS = own-row (full columns) for authenticated.
--   • Column privileges revoke secrets from anon/authenticated on leagues.
--   • SECURITY DEFINER views expose only non-sensitive columns for directory /
--     leaderboard reads (bypass base-table own-row RLS intentionally).
-- -----------------------------------------------------------------------------

-- ----- profiles: drop permissive reads -----
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow read for profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow raw read for profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid())::text = id
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid())::text = id
  )
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid())::text = id
  );

-- Prevent clients from elevating themselves to admin via UPDATE.
REVOKE UPDATE (is_admin) ON public.profiles FROM PUBLIC;
REVOKE UPDATE (is_admin) ON public.profiles FROM anon;
REVOKE UPDATE (is_admin) ON public.profiles FROM authenticated;

-- Public directory view (no email / phone / dob / is_admin).
-- SECURITY DEFINER: readable across users; only safe columns projected.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.username,
  p.first_name,
  p.surname,
  p.nationality,
  p.supported_team,
  p.preferred_sport,
  p.is_verified,
  p.is_profile_public,
  p.created_at,
  p.favorite_f1_team,
  p.favorite_golfer,
  p.selected_sports
FROM public.profiles p
WHERE p.username IS NOT NULL
  AND p.username NOT LIKE 'freed_nick_%';

COMMENT ON VIEW public.public_profiles IS
  'Safe profile projection for leaderboards / member lists. No email, phone, dob, or is_admin. Query this instead of profiles for other users.';

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ----- leagues: drop duplicates + rewrite (initplan) -----
DROP POLICY IF EXISTS "Anyone can read leagues" ON public.leagues;
DROP POLICY IF EXISTS "Allow raw read for leagues" ON public.leagues;
DROP POLICY IF EXISTS "Authenticated users can create leagues" ON public.leagues;
DROP POLICY IF EXISTS "Creator can update league" ON public.leagues;
DROP POLICY IF EXISTS "leagues insert authenticated" ON public.leagues;
DROP POLICY IF EXISTS "leagues update by creator or admin" ON public.leagues;
DROP POLICY IF EXISTS "leagues delete by creator or admin" ON public.leagues;
DROP POLICY IF EXISTS "leagues_select_public" ON public.leagues;
DROP POLICY IF EXISTS "leagues_insert_authenticated" ON public.leagues;
DROP POLICY IF EXISTS "leagues_update_creator_or_admin" ON public.leagues;
DROP POLICY IF EXISTS "leagues_delete_creator_or_admin" ON public.leagues;

CREATE POLICY "leagues_select_public"
  ON public.leagues
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "leagues_insert_authenticated"
  ON public.leagues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (
      (select auth.uid())::text = creator_id
      OR public.is_pitchside_admin()
    )
  );

CREATE POLICY "leagues_update_creator_or_admin"
  ON public.leagues
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (
      (select auth.uid())::text = creator_id
      OR public.is_pitchside_admin()
    )
  )
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (
      (select auth.uid())::text = creator_id
      OR public.is_pitchside_admin()
    )
  );

CREATE POLICY "leagues_delete_creator_or_admin"
  ON public.leagues
  FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (
      (select auth.uid())::text = creator_id
      OR public.is_pitchside_admin()
    )
  );

-- Block direct reads of join secrets / deprecated members JSONB.
-- get_league_password() (SECURITY DEFINER) still returns password to members.
REVOKE SELECT (password) ON public.leagues FROM PUBLIC;
REVOKE SELECT (password) ON public.leagues FROM anon;
REVOKE SELECT (password) ON public.leagues FROM authenticated;

REVOKE SELECT (members) ON public.leagues FROM PUBLIC;
REVOKE SELECT (members) ON public.leagues FROM anon;
REVOKE SELECT (members) ON public.leagues FROM authenticated;

-- Safe league projection (explicit; mirrors app LEAGUE_PUBLIC_COLUMNS).
CREATE OR REPLACE VIEW public.public_leagues
WITH (security_invoker = false)
AS
SELECT
  l.id,
  l.name,
  l.competition_id,
  l.creator_id,
  l.creator_name,
  l.is_private,
  l.is_public,
  l.max_players,
  l.max_participants,
  l.season,
  l.is_archived,
  l.created_at,
  l.updated_at
FROM public.leagues l;

COMMENT ON VIEW public.public_leagues IS
  'League metadata without password or members JSONB. Prefer this over selecting * from leagues.';

GRANT SELECT ON public.public_leagues TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4) archived_players / unsubscribed_emails — lock down (H1)
--    No policies for anon/authenticated ⇒ denied. service_role bypasses RLS.
--    Admin read via is_pitchside_admin() only.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow any write for archived_players" ON public.archived_players;
DROP POLICY IF EXISTS "Allow raw read for archived_players" ON public.archived_players;
DROP POLICY IF EXISTS "archived_players_admin_select" ON public.archived_players;

DROP POLICY IF EXISTS "Allow any write for unsubscribed_emails" ON public.unsubscribed_emails;
DROP POLICY IF EXISTS "Allow raw read for unsubscribed_emails" ON public.unsubscribed_emails;
DROP POLICY IF EXISTS "unsubscribed_emails_admin_select" ON public.unsubscribed_emails;

CREATE POLICY "archived_players_admin_select"
  ON public.archived_players
  FOR SELECT
  TO authenticated
  USING (public.is_pitchside_admin());

CREATE POLICY "unsubscribed_emails_admin_select"
  ON public.unsubscribed_emails
  FOR SELECT
  TO authenticated
  USING (public.is_pitchside_admin());

-- Writes: service_role only (no INSERT/UPDATE/DELETE policies for clients).

-- -----------------------------------------------------------------------------
-- 4b) matches — consolidate duplicate SELECT + keep admin writes (M4)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read for matches" ON public.matches;
DROP POLICY IF EXISTS "Anyone can read matches" ON public.matches;
DROP POLICY IF EXISTS "Allow raw read for matches" ON public.matches;
DROP POLICY IF EXISTS "matches_select_public" ON public.matches;
DROP POLICY IF EXISTS "matches admin insert" ON public.matches;
DROP POLICY IF EXISTS "matches admin update" ON public.matches;
DROP POLICY IF EXISTS "matches admin delete" ON public.matches;
DROP POLICY IF EXISTS "matches_admin_insert" ON public.matches;
DROP POLICY IF EXISTS "matches_admin_update" ON public.matches;
DROP POLICY IF EXISTS "matches_admin_delete" ON public.matches;

CREATE POLICY "matches_select_public"
  ON public.matches
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "matches_admin_insert"
  ON public.matches
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_pitchside_admin());

CREATE POLICY "matches_admin_update"
  ON public.matches
  FOR UPDATE
  TO authenticated
  USING (public.is_pitchside_admin())
  WITH CHECK (public.is_pitchside_admin());

CREATE POLICY "matches_admin_delete"
  ON public.matches
  FOR DELETE
  TO authenticated
  USING (public.is_pitchside_admin());

-- -----------------------------------------------------------------------------
-- 4c) league_members — consolidate + initplan (M3, M4)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated join" ON public.league_members;
DROP POLICY IF EXISTS "Allow authenticated leave" ON public.league_members;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.league_members;
DROP POLICY IF EXISTS "league_members read" ON public.league_members;
DROP POLICY IF EXISTS "league_members join self" ON public.league_members;
DROP POLICY IF EXISTS "league_members leave self" ON public.league_members;
DROP POLICY IF EXISTS "league_members_select_public" ON public.league_members;
DROP POLICY IF EXISTS "league_members_insert_own" ON public.league_members;
DROP POLICY IF EXISTS "league_members_delete_own" ON public.league_members;

CREATE POLICY "league_members_select_public"
  ON public.league_members
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "league_members_insert_own"
  ON public.league_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid())::text = user_id
  );

CREATE POLICY "league_members_delete_own"
  ON public.league_members
  FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (select auth.uid())::text = user_id
  );

-- -----------------------------------------------------------------------------
-- 5) Emerging sports FK indexes (L1)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_f1_drivers_constructor_id
  ON public.f1_drivers (constructor_id);

CREATE INDEX IF NOT EXISTS idx_f1_predictions_race_id
  ON public.f1_predictions (race_id);

CREATE INDEX IF NOT EXISTS idx_golf_predictions_tournament_id
  ON public.golf_predictions (tournament_id);

-- =============================================================================
-- CLIENT FOLLOW-UPS (not applied by SQL — adjust the app after migrating)
-- =============================================================================
-- 1. Other users / leaderboards: query public.public_profiles (not profiles *).
--    Own account settings may still use profiles (own-row RLS allows PII).
-- 2. League lists: prefer public.public_leagues, or keep LEAGUE_PUBLIC_COLUMNS
--    on leagues (password/members columns are now revoked — SELECT * will fail).
-- 3. League archive / member PII hydration: join league_members → public_profiles.
-- 4. get_email_by_nickname is no longer callable as anon — nickname-before-auth
--    login must be redesigned (email login, or Edge Function with rate limits).
-- 5. dbSaveArchivedPlayer / dbSaveUnsubscribedEmail must run via service_role
--    (Edge Function) — client inserts are now denied by RLS.
-- 6. Admin is_admin flips: use a SECURITY DEFINER RPC or service_role; clients
--    can no longer UPDATE profiles.is_admin.
-- 7. Post-kickoff shared prediction reads: add a dedicated RPC/view later (C3).
-- =============================================================================
