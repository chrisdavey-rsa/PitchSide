-- =============================================================================
-- Revert base scoring to 5/3/1/0 + lock-time power-up consumption RPC
-- Also installs evaluate_powerup_unlocks if missing from prior partial apply.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pitchside_football_points(
  predicted_home integer,
  predicted_away integer,
  actual_home integer,
  actual_away integer
) RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  predicted_winner text;
  actual_winner text;
  predicted_margin integer;
  actual_margin integer;
BEGIN
  predicted_winner := CASE
    WHEN predicted_home > predicted_away THEN 'home'
    WHEN predicted_home < predicted_away THEN 'away'
    ELSE 'draw'
  END;
  actual_winner := CASE
    WHEN actual_home > actual_away THEN 'home'
    WHEN actual_home < actual_away THEN 'away'
    ELSE 'draw'
  END;

  IF predicted_winner <> actual_winner THEN
    RETURN 0;
  END IF;

  IF predicted_home = actual_home AND predicted_away = actual_away THEN
    RETURN 5;
  END IF;

  predicted_margin := predicted_home - predicted_away;
  actual_margin := actual_home - actual_away;
  IF predicted_margin = actual_margin THEN
    RETURN 3;
  END IF;

  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.pitchside_rugby_points(
  predicted_home integer,
  predicted_away integer,
  actual_home integer,
  actual_away integer
) RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  predicted_winner text;
  actual_winner text;
  predicted_margin integer;
  actual_margin integer;
  margin_difference integer;
BEGIN
  predicted_winner := CASE
    WHEN predicted_home > predicted_away THEN 'home'
    WHEN predicted_home < predicted_away THEN 'away'
    ELSE 'draw'
  END;
  actual_winner := CASE
    WHEN actual_home > actual_away THEN 'home'
    WHEN actual_home < actual_away THEN 'away'
    ELSE 'draw'
  END;

  IF predicted_winner <> actual_winner THEN
    RETURN 0;
  END IF;

  predicted_margin := ABS(predicted_home - predicted_away);
  actual_margin := ABS(actual_home - actual_away);
  margin_difference := ABS(predicted_margin - actual_margin);

  IF margin_difference = 0 THEN RETURN 5; END IF;
  IF margin_difference <= 7 THEN RETURN 3; END IF;
  IF margin_difference <= 10 THEN RETURN 1; END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.pitchside_apply_powerup(
  p_base_points integer,
  p_powerup public.powerup_type,
  p_is_exact boolean,
  p_outcome_correct boolean
) RETURNS TABLE (earned_points integer, is_banker_exact boolean)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_points integer := COALESCE(p_base_points, 0);
  v_banker boolean := false;
  EXACT_SCORE_POINTS constant integer := 5;
  SAFETY_FLOOR constant integer := 5;
BEGIN
  IF p_powerup IS NULL THEN
    earned_points := v_points;
    is_banker_exact := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_powerup = 'banker' THEN
    IF p_outcome_correct THEN
      v_points := EXACT_SCORE_POINTS;
      v_banker := true;
    END IF;
  ELSIF p_powerup = 'sniper' THEN
    IF p_is_exact THEN
      v_points := ROUND(v_points * 1.5)::integer;
    END IF;
  END IF;

  IF p_powerup = 'double_bubble' THEN
    v_points := v_points * 2;
  ELSIF p_powerup = 'pitchside_master' THEN
    v_points := v_points * 3;
  END IF;

  IF p_powerup = 'safety_net' AND v_points = 0 THEN
    v_points := SAFETY_FLOOR;
  END IF;

  earned_points := v_points;
  is_banker_exact := v_banker;
  RETURN NEXT;
END;
$$;

-- Allow a user to grant themselves baseline Double Bubble for active seasons
CREATE OR REPLACE FUNCTION public.grant_baseline_double_bubble(p_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid()::text IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  FOR r IN
    SELECT id, sport_type
    FROM public.sport_seasons
    WHERE is_active = true
      AND sport_type IN ('football', 'rugby')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.user_powerups
      WHERE user_id = p_user_id
        AND sport_season_id = r.id
        AND powerup_type = 'double_bubble'
        AND status IN ('available', 'used')
    ) THEN
      INSERT INTO public.user_powerups (
        user_id, powerup_type, sport_type, sport_season_id, status, earned_at
      ) VALUES (
        p_user_id, 'double_bubble', r.sport_type, r.id, 'available', timezone('utc', now())
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_baseline_double_bubble(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_baseline_double_bubble(text) TO authenticated, service_role;

-- Lock prediction + consume power-up atomically
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
  v_pred_id text := p_user_id || '_' || p_match_id;
  v_powerup public.user_powerups%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid()::text IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT kickoff_time INTO v_kickoff
  FROM public.matches
  WHERE id = p_match_id;

  IF v_kickoff IS NOT NULL AND timezone('utc', now()) >= v_kickoff THEN
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
GRANT EXECUTE ON FUNCTION public.pitchside_lock_prediction(text, text, text, text, integer, integer, uuid) TO authenticated, service_role;

-- Unlock evaluator (idempotent install)
CREATE OR REPLACE FUNCTION public.evaluate_powerup_unlocks(
  p_user_id text,
  p_sport_type public.powerup_sport_type,
  p_season_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid := p_season_id;
  v_exact_count integer := 0;
  v_streak integer := 0;
  v_granted text[] := ARRAY[]::text[];
  v_multi_sports integer := 0;
  v_accuracy numeric := 0;
  v_hits integer := 0;
  v_total integer := 0;
BEGIN
  IF v_season_id IS NULL THEN
    SELECT id INTO v_season_id
    FROM public.sport_seasons
    WHERE sport_type = p_sport_type AND is_active = true
    ORDER BY starts_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_season_id IS NULL THEN
    RETURN jsonb_build_object('granted', '[]'::jsonb, 'reason', 'no_active_season');
  END IF;

  WITH last_gws AS (
    SELECT gw FROM (
      SELECT COALESCE(m.round_name, to_char(date_trunc('week', m.kickoff_time), 'IYYY-"W"IW')) AS gw,
             MAX(m.kickoff_time) AS last_ko
      FROM public.predictions p
      JOIN public.matches m ON m.id = p.match_id
      WHERE p.user_id = p_user_id AND p.submitted = true AND p.sport = p_sport_type::text AND m.kickoff_time IS NOT NULL
      GROUP BY 1 ORDER BY last_ko DESC LIMIT 10
    ) recent_gws
  )
  SELECT COUNT(*)::int INTO v_exact_count
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id
  WHERE p.user_id = p_user_id AND p.submitted = true AND p.sport = p_sport_type::text
    AND COALESCE(p.is_banker_exact, false) = false AND m.status = 'completed'
    AND m.actual_home_score IS NOT NULL AND m.actual_away_score IS NOT NULL
    AND p.predicted_home_score = m.actual_home_score AND p.predicted_away_score = m.actual_away_score
    AND COALESCE(m.round_name, to_char(date_trunc('week', m.kickoff_time), 'IYYY-"W"IW')) IN (SELECT gw FROM last_gws);

  IF v_exact_count >= 3 AND NOT EXISTS (
    SELECT 1 FROM public.user_powerups WHERE user_id = p_user_id AND sport_season_id = v_season_id
      AND powerup_type = 'sniper' AND status IN ('available', 'used')
  ) THEN
    INSERT INTO public.user_powerups (user_id, powerup_type, sport_type, sport_season_id, status, earned_at)
    VALUES (p_user_id, 'sniper', p_sport_type, v_season_id, 'available', timezone('utc', now()));
    v_granted := array_append(v_granted, 'sniper');
  END IF;

  WITH weeks AS (
    SELECT DISTINCT date_trunc('week', m.kickoff_time)::date AS week_start
    FROM public.predictions p JOIN public.matches m ON m.id = p.match_id
    WHERE p.user_id = p_user_id AND p.submitted = true AND p.sport = p_sport_type::text AND m.kickoff_time IS NOT NULL
  ), ordered AS (
    SELECT week_start, (week_start + ((ROW_NUMBER() OVER (ORDER BY week_start DESC) - 1) * 7))::date AS expected FROM weeks
  )
  SELECT COUNT(*)::int INTO v_streak FROM ordered WHERE week_start = expected;

  IF v_streak >= 3 AND NOT EXISTS (
    SELECT 1 FROM public.user_powerups WHERE user_id = p_user_id AND sport_season_id = v_season_id
      AND powerup_type = 'safety_net' AND status = 'available'
  ) THEN
    INSERT INTO public.user_powerups (user_id, powerup_type, sport_type, sport_season_id, status, earned_at)
    VALUES (p_user_id, 'safety_net', p_sport_type, v_season_id, 'available', timezone('utc', now()));
    v_granted := array_append(v_granted, 'safety_net');
  END IF;

  WITH weeks AS (
    SELECT DISTINCT date_trunc('week', m.kickoff_time)::date AS week_start
    FROM public.predictions p JOIN public.matches m ON m.id = p.match_id
    WHERE p.user_id = p_user_id AND p.submitted = true AND m.kickoff_time IS NOT NULL
      AND m.kickoff_time >= (timezone('utc', now()) - interval '70 days')
  ), ordered AS (
    SELECT week_start, (week_start + ((ROW_NUMBER() OVER (ORDER BY week_start DESC) - 1) * 7))::date AS expected FROM weeks
  )
  SELECT COUNT(*)::int INTO v_streak FROM ordered WHERE week_start = expected;

  SELECT COUNT(DISTINCT p.sport)::int INTO v_multi_sports
  FROM public.predictions p JOIN public.matches m ON m.id = p.match_id
  WHERE p.user_id = p_user_id AND p.submitted = true
    AND m.kickoff_time >= (timezone('utc', now()) - interval '70 days');

  SELECT COALESCE(SUM(CASE WHEN m.status = 'completed' AND m.actual_home_score IS NOT NULL AND m.actual_away_score IS NOT NULL AND (
    CASE WHEN p.sport = 'football' THEN public.pitchside_football_points(p.predicted_home_score, p.predicted_away_score, m.actual_home_score, m.actual_away_score)
         ELSE public.pitchside_rugby_points(p.predicted_home_score, p.predicted_away_score, m.actual_home_score, m.actual_away_score) END
  ) > 0 THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN m.status = 'completed' AND m.actual_home_score IS NOT NULL AND m.actual_away_score IS NOT NULL THEN 1 ELSE 0 END), 0)
  INTO v_hits, v_total
  FROM public.predictions p JOIN public.matches m ON m.id = p.match_id
  WHERE p.user_id = p_user_id AND p.submitted = true
    AND m.kickoff_time >= (timezone('utc', now()) - interval '70 days');

  IF v_total > 0 THEN v_accuracy := (v_hits::numeric / v_total::numeric) * 100; ELSE v_accuracy := 0; END IF;

  IF v_streak >= 8 AND v_multi_sports >= 2 AND v_accuracy >= 65 AND NOT EXISTS (
    SELECT 1 FROM public.user_powerups WHERE user_id = p_user_id AND sport_season_id = v_season_id
      AND powerup_type = 'pitchside_master' AND status IN ('available', 'used')
  ) THEN
    INSERT INTO public.user_powerups (user_id, powerup_type, sport_type, sport_season_id, status, earned_at)
    VALUES (p_user_id, 'pitchside_master', p_sport_type, v_season_id, 'available', timezone('utc', now()));
    v_granted := array_append(v_granted, 'pitchside_master');
  END IF;

  RETURN jsonb_build_object(
    'granted', to_jsonb(v_granted), 'season_id', v_season_id, 'exact_count', v_exact_count,
    'submission_streak_weeks', v_streak, 'accuracy_pct', v_accuracy, 'multi_sports', v_multi_sports
  );
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_powerup_unlocks(text, public.powerup_sport_type, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_powerup_unlocks(text, public.powerup_sport_type, uuid) TO authenticated, service_role;
