-- =============================================================================
-- Audit fixes (2026-07-26):
-- 1) Prediction lock trigger must allow settlement column writes after kickoff
-- 2) Strengthen pitchside_lock_prediction (status + kickoff)
-- 3) Re-apply predictions / user_powerups RLS (own-row integrity)
-- 4) Lock down archived_players / unsubscribed_emails + revoke anon RPC abuse
-- 5) Global leaderboard: gameweek drops + power-up settle (align with rules)
-- 6) search_path hardening on scoring helpers
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Lock trigger — only block prediction *content* changes after kickoff
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_prediction_lock_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_kickoff timestamptz;
  v_status text;
BEGIN
  -- Settlement / grading may update points after FT without touching the pick.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.predicted_home_score IS NOT DISTINCT FROM OLD.predicted_home_score
       AND NEW.predicted_away_score IS NOT DISTINCT FROM OLD.predicted_away_score
       AND NEW.predicted_winner IS NOT DISTINCT FROM OLD.predicted_winner
       AND NEW.predicted_margin IS NOT DISTINCT FROM OLD.predicted_margin
       AND NEW.submitted IS NOT DISTINCT FROM OLD.submitted
       AND NEW.applied_powerup_id IS NOT DISTINCT FROM OLD.applied_powerup_id
       AND NEW.match_id IS NOT DISTINCT FROM OLD.match_id
       AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
       AND NEW.sport IS NOT DISTINCT FROM OLD.sport
       AND NEW.competition_id IS NOT DISTINCT FROM OLD.competition_id
    THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT m.kickoff_time, m.status
  INTO v_kickoff, v_status
  FROM public.matches m
  WHERE m.id = NEW.match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event locked. Predictions can no longer be submitted.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status IN ('live', 'completed')
     OR v_kickoff IS NULL
     OR timezone('utc', now()) >= v_kickoff THEN
    RAISE EXCEPTION 'Event locked. Predictions can no longer be submitted.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.enforce_prediction_lock_time() IS
  'Blocks prediction pick/submit changes after kickoff; allows settlement fields (points_won, provisional_points, is_banker_exact).';

REVOKE ALL ON FUNCTION public.enforce_prediction_lock_time() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_prediction_lock_time() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_prediction_lock_time() FROM authenticated;

-- -----------------------------------------------------------------------------
-- 2) Lock RPC — also reject live/completed fixtures
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pitchside_lock_prediction(
  p_user_id text,
  p_match_id text,
  p_sport text,
  p_competition_id text,
  p_home integer,
  p_away integer,
  p_powerup_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kickoff timestamptz;
  v_status text;
  v_pred_id text := p_user_id || '_' || p_match_id;
  v_powerup public.user_powerups%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid()::text IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT kickoff_time, status INTO v_kickoff, v_status
  FROM public.matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event locked. Predictions can no longer be submitted.';
  END IF;

  IF v_status IN ('live', 'completed')
     OR v_kickoff IS NULL
     OR timezone('utc', now()) >= v_kickoff THEN
    RAISE EXCEPTION 'Event locked. Predictions can no longer be submitted.';
  END IF;

  IF p_powerup_id IS NOT NULL THEN
    SELECT * INTO v_powerup
    FROM public.user_powerups
    WHERE id = p_powerup_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Power-up not found';
    END IF;
    IF v_powerup.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'Power-up does not belong to user';
    END IF;
    IF v_powerup.status IS DISTINCT FROM 'available' THEN
      RAISE EXCEPTION 'Power-up is not available';
    END IF;
  END IF;

  INSERT INTO public.predictions (
    id, user_id, match_id, sport, competition_id, season,
    predicted_home_score, predicted_away_score, submitted,
    applied_powerup_id, created_at
  ) VALUES (
    v_pred_id, p_user_id, p_match_id, p_sport, p_competition_id, '2026',
    p_home, p_away, true,
    p_powerup_id, timezone('utc', now())
  )
  ON CONFLICT (id) DO UPDATE SET
    predicted_home_score = EXCLUDED.predicted_home_score,
    predicted_away_score = EXCLUDED.predicted_away_score,
    submitted = true,
    sport = EXCLUDED.sport,
    competition_id = EXCLUDED.competition_id,
    applied_powerup_id = COALESCE(EXCLUDED.applied_powerup_id, public.predictions.applied_powerup_id),
    created_at = CASE
      WHEN public.predictions.submitted IS TRUE THEN public.predictions.created_at
      ELSE EXCLUDED.created_at
    END;

  IF p_powerup_id IS NOT NULL THEN
    UPDATE public.user_powerups
    SET
      status = 'used',
      used_at = timezone('utc', now()),
      applied_fixture_id = p_match_id
    WHERE id = p_powerup_id
      AND status = 'available';
  END IF;

  RETURN jsonb_build_object(
    'prediction_id', v_pred_id,
    'applied_powerup_id', p_powerup_id,
    'consumed', p_powerup_id IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pitchside_lock_prediction(text, text, text, text, integer, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pitchside_lock_prediction(text, text, text, text, integer, integer, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pitchside_lock_prediction(text, text, text, text, integer, integer, uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) Predictions RLS — own-row (+ admin read for tooling)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read predictions" ON public.predictions;
DROP POLICY IF EXISTS "Allow raw read for predictions" ON public.predictions;
DROP POLICY IF EXISTS "Users can insert own predictions" ON public.predictions;
DROP POLICY IF EXISTS "Users can update own predictions" ON public.predictions;
DROP POLICY IF EXISTS "predictions_select_own" ON public.predictions;
DROP POLICY IF EXISTS "predictions_select_admin" ON public.predictions;
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

CREATE POLICY "predictions_select_admin"
  ON public.predictions
  FOR SELECT
  TO authenticated
  USING (public.is_pitchside_admin());

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

-- user_powerups: clients may read own inventory; mutations only via SECURITY DEFINER / service_role
DROP POLICY IF EXISTS "user_powerups_update_own_available" ON public.user_powerups;
DROP POLICY IF EXISTS "user_powerups_update_own" ON public.user_powerups;

-- Legacy empty wallet table (RLS on, no policies) — deny all client access explicitly
DO $$
BEGIN
  IF to_regclass('public.power_up_wallet') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "power_up_wallet_deny_all" ON public.power_up_wallet';
    EXECUTE $p$
      CREATE POLICY "power_up_wallet_deny_all"
        ON public.power_up_wallet
        FOR ALL
        TO anon, authenticated
        USING (false)
        WITH CHECK (false)
    $p$;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4) archived / unsubscribed lockdown + dangerous RPC revoke from anon
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

-- Profiles: drop fully-public read (anon); keep authenticated directory for leagues UI
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;

-- Matches: drop duplicate public SELECT if present (keep one)
DROP POLICY IF EXISTS "Anyone can read matches" ON public.matches;

REVOKE EXECUTE ON FUNCTION public.evaluate_powerup_unlocks(text, public.powerup_sport_type, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_powerups_on_season_deactivate() FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_baseline_double_bubble(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_league_password(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_league_secure(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reserve_api_quota(date, text, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_api_quota_headers(date, text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_api_quota_usage(date, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

-- Keep auth-required for join/password; lock RPCs already granted above
GRANT EXECUTE ON FUNCTION public.join_league_secure(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_league_password(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5) Global leaderboard — gameweek drops + power-up settlement
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_global_leaderboard(
  p_current_user_id text DEFAULT NULL
)
RETURNS TABLE(
  player_id text,
  nickname text,
  first_name text,
  surname text,
  nationality text,
  points_football bigint,
  points_rugby bigint,
  predictions_football bigint,
  predictions_rugby bigint,
  total_points bigint,
  is_profile_public boolean,
  ghost_points bigint,
  ghost_points_football bigint,
  ghost_points_rugby bigint,
  drops_used integer,
  drops_used_football integer,
  drops_used_rugby integer,
  drops_allowed integer,
  drops_allowed_football integer,
  drops_allowed_rugby integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH scored AS (
    SELECT
      pred.user_id,
      pred.sport,
      COALESCE(m.competition_id, pred.competition_id) AS competition_id,
      COALESCE(m.round_name, to_char(date_trunc('week', m.kickoff_time), 'IYYY-"W"IW')) AS gameweek_key,
      (
        SELECT s.earned_points
        FROM public.pitchside_settle_prediction_points(
          pred.predicted_home_score,
          pred.predicted_away_score,
          m.actual_home_score,
          m.actual_away_score,
          pred.sport,
          up.powerup_type
        ) s
      ) AS points
    FROM public.predictions pred
    JOIN public.matches m ON m.id = pred.match_id
    LEFT JOIN public.user_powerups up ON up.id = pred.applied_powerup_id
    WHERE pred.submitted = true
      AND m.status = 'completed'
      AND m.actual_home_score IS NOT NULL
      AND m.actual_away_score IS NOT NULL
  ),
  prediction_counts AS (
    SELECT
      pred.user_id,
      COUNT(*) FILTER (WHERE pred.sport = 'football') AS predictions_football,
      COUNT(*) FILTER (WHERE pred.sport = 'rugby') AS predictions_rugby
    FROM public.predictions pred
    WHERE pred.submitted = true
    GROUP BY pred.user_id
  ),
  by_week AS (
    SELECT
      user_id,
      sport,
      competition_id,
      gameweek_key,
      SUM(points)::integer AS week_points
    FROM scored
    GROUP BY user_id, sport, competition_id, gameweek_key
  ),
  ranked AS (
    SELECT
      bw.user_id,
      bw.sport,
      bw.competition_id,
      bw.week_points,
      public.pitchside_competition_drops(bw.competition_id) AS drops_allowed,
      ROW_NUMBER() OVER (
        PARTITION BY bw.user_id, bw.competition_id
        ORDER BY bw.week_points ASC, bw.gameweek_key
      ) AS rn_asc,
      COUNT(*) OVER (
        PARTITION BY bw.user_id, bw.competition_id
      ) AS weeks_played
    FROM by_week bw
  ),
  comp_final AS (
    SELECT
      r.user_id,
      r.sport,
      r.competition_id,
      MAX(r.drops_allowed)::integer AS drops_allowed,
      CASE
        WHEN MAX(r.weeks_played) > MAX(r.drops_allowed)
        THEN MAX(r.drops_allowed)
        ELSE 0
      END::integer AS drops_used,
      SUM(r.week_points)::bigint AS ghost_points,
      SUM(
        CASE
          WHEN r.weeks_played > r.drops_allowed
               AND r.rn_asc <= r.drops_allowed
          THEN 0
          ELSE r.week_points
        END
      )::bigint AS best_points
    FROM ranked r
    GROUP BY r.user_id, r.sport, r.competition_id
  ),
  sport_agg AS (
    SELECT
      cf.user_id,
      COALESCE(SUM(cf.best_points) FILTER (WHERE cf.sport = 'football'), 0) AS points_football,
      COALESCE(SUM(cf.best_points) FILTER (WHERE cf.sport = 'rugby'), 0) AS points_rugby,
      COALESCE(SUM(cf.ghost_points) FILTER (WHERE cf.sport = 'football'), 0) AS ghost_football,
      COALESCE(SUM(cf.ghost_points) FILTER (WHERE cf.sport = 'rugby'), 0) AS ghost_rugby,
      COALESCE(SUM(cf.drops_used) FILTER (WHERE cf.sport = 'football'), 0) AS drops_used_football,
      COALESCE(SUM(cf.drops_used) FILTER (WHERE cf.sport = 'rugby'), 0) AS drops_used_rugby,
      COALESCE(SUM(cf.drops_allowed) FILTER (WHERE cf.sport = 'football'), 0) AS drops_allowed_football,
      COALESCE(SUM(cf.drops_allowed) FILTER (WHERE cf.sport = 'rugby'), 0) AS drops_allowed_rugby
    FROM comp_final cf
    GROUP BY cf.user_id
  )
  SELECT
    p.id AS player_id,
    COALESCE(p.username, 'Contestant') AS nickname,
    COALESCE(p.first_name, '') AS first_name,
    COALESCE(p.surname, '') AS surname,
    COALESCE(p.nationality, 'United Kingdom') AS nationality,
    COALESCE(sa.points_football, 0) AS points_football,
    COALESCE(sa.points_rugby, 0) AS points_rugby,
    COALESCE(pc.predictions_football, 0) AS predictions_football,
    COALESCE(pc.predictions_rugby, 0) AS predictions_rugby,
    COALESCE(sa.points_football, 0) + COALESCE(sa.points_rugby, 0) AS total_points,
    COALESCE(p.is_profile_public, true) AS is_profile_public,
    COALESCE(sa.ghost_football, 0) + COALESCE(sa.ghost_rugby, 0) AS ghost_points,
    COALESCE(sa.ghost_football, 0) AS ghost_points_football,
    COALESCE(sa.ghost_rugby, 0) AS ghost_points_rugby,
    (COALESCE(sa.drops_used_football, 0) + COALESCE(sa.drops_used_rugby, 0))::int AS drops_used,
    COALESCE(sa.drops_used_football, 0)::int AS drops_used_football,
    COALESCE(sa.drops_used_rugby, 0)::int AS drops_used_rugby,
    (COALESCE(sa.drops_allowed_football, 0) + COALESCE(sa.drops_allowed_rugby, 0))::int AS drops_allowed,
    COALESCE(sa.drops_allowed_football, 0)::int AS drops_allowed_football,
    COALESCE(sa.drops_allowed_rugby, 0)::int AS drops_allowed_rugby
  FROM public.profiles p
  LEFT JOIN sport_agg sa ON sa.user_id = p.id
  LEFT JOIN prediction_counts pc ON pc.user_id = p.id
  WHERE p.username IS NOT NULL
    AND p.username NOT LIKE 'freed_nick_%'
  ORDER BY total_points DESC, nickname ASC;
$function$;

ALTER FUNCTION public.get_global_leaderboard(text) SET search_path = public;
ALTER FUNCTION public.get_competition_leaderboard(text, text) SET search_path = public;
ALTER FUNCTION public.get_rugby_leaderboard(text, text) SET search_path = public;

-- Leaderboards must bypass own-row prediction RLS (aggregate across players).
ALTER FUNCTION public.get_global_leaderboard(text) SECURITY DEFINER;
ALTER FUNCTION public.get_competition_leaderboard(text, text) SECURITY DEFINER;
ALTER FUNCTION public.get_rugby_leaderboard(text, text) SECURITY DEFINER;

ALTER FUNCTION public.pitchside_football_points(integer, integer, integer, integer) SET search_path = public;
ALTER FUNCTION public.pitchside_rugby_points(integer, integer, integer, integer) SET search_path = public;
ALTER FUNCTION public.pitchside_apply_powerup(integer, public.powerup_type, boolean, boolean) SET search_path = public;
ALTER FUNCTION public.pitchside_settle_prediction_points(integer, integer, integer, integer, text, public.powerup_type) SET search_path = public;
ALTER FUNCTION public.pitchside_competition_drops(text) SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_global_leaderboard(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_competition_leaderboard(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rugby_leaderboard(text, text) TO authenticated;
