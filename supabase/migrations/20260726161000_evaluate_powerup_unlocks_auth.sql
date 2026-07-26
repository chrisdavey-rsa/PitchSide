-- Auth gate for evaluate_powerup_unlocks: self, admin, or service_role (auth.uid null).
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
  IF auth.uid() IS NOT NULL
     AND auth.uid()::text IS DISTINCT FROM p_user_id
     AND NOT public.is_pitchside_admin() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

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
REVOKE ALL ON FUNCTION public.evaluate_powerup_unlocks(text, public.powerup_sport_type, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.evaluate_powerup_unlocks(text, public.powerup_sport_type, uuid) TO authenticated, service_role;
