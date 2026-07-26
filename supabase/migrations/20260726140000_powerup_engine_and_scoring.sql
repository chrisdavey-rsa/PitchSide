-- =============================================================================
-- Power-Up inventory, sport seasons, scoring modifiers, unlocks, drop-week RPCs
-- =============================================================================
-- Notes:
-- * Live schema uses a unified `public.predictions` table (not football_/rugby_).
-- * profiles.id / matches.id are TEXT — user_id and applied_fixture_id follow that.
-- * Football base bands: Outcome 1 · Exact GD 3 · Exact score 5 (reverted from 10/15/25).
-- * Drop allowances: EPL 3 · Scottish Prem 3 · Championship 4 · else 0.
-- * NOTE: 20260726150000_revert_scoring_531_and_lock_powerup.sql is the source of
--   truth for live 5/3/1 scoring + pitchside_lock_prediction after this file.
-- =============================================================================

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE public.powerup_type AS ENUM (
    'double_bubble',
    'safety_net',
    'sniper',
    'banker',
    'pitchside_master'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.powerup_sport_type AS ENUM (
    'football',
    'rugby',
    'f1',
    'golf'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.powerup_status AS ENUM (
    'available',
    'used',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- Sport seasons ----------
CREATE TABLE IF NOT EXISTS public.sport_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_type public.powerup_sport_type NOT NULL,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  global_league_id text REFERENCES public.leagues(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (sport_type, label)
);

CREATE INDEX IF NOT EXISTS sport_seasons_active_idx
  ON public.sport_seasons (sport_type, is_active)
  WHERE is_active = true;

ALTER TABLE public.sport_seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sport_seasons_select_authenticated" ON public.sport_seasons;
CREATE POLICY "sport_seasons_select_authenticated"
  ON public.sport_seasons FOR SELECT TO authenticated
  USING (true);

-- Seed current seasons (idempotent)
INSERT INTO public.sport_seasons (sport_type, label, is_active, global_league_id, starts_at)
VALUES
  ('football', '2025/26', true, 'GLOBAL_LEAGUE', timezone('utc', now())),
  ('rugby', '2025/26', true, 'GLOBAL_LEAGUE', timezone('utc', now())),
  ('f1', '2026', false, 'GLOBAL_LEAGUE', NULL),
  ('golf', '2026', false, 'GLOBAL_LEAGUE', NULL)
ON CONFLICT (sport_type, label) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  global_league_id = COALESCE(public.sport_seasons.global_league_id, EXCLUDED.global_league_id),
  updated_at = timezone('utc', now());

-- ---------- user_powerups ----------
CREATE TABLE IF NOT EXISTS public.user_powerups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  powerup_type public.powerup_type NOT NULL,
  sport_type public.powerup_sport_type NOT NULL,
  sport_season_id uuid NOT NULL REFERENCES public.sport_seasons(id) ON DELETE CASCADE,
  status public.powerup_status NOT NULL DEFAULT 'available',
  earned_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  used_at timestamptz,
  applied_fixture_id text REFERENCES public.matches(id) ON DELETE SET NULL,
  CONSTRAINT user_powerups_used_requires_fixture
    CHECK (
      status <> 'used'
      OR (used_at IS NOT NULL AND applied_fixture_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS user_powerups_user_season_idx
  ON public.user_powerups (user_id, sport_season_id, status);

CREATE INDEX IF NOT EXISTS user_powerups_type_season_idx
  ON public.user_powerups (powerup_type, sport_season_id, status);

-- At most one available chip of each type per user/season
CREATE UNIQUE INDEX IF NOT EXISTS user_powerups_one_available_per_type
  ON public.user_powerups (user_id, sport_season_id, powerup_type)
  WHERE status = 'available';

ALTER TABLE public.user_powerups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_powerups_select_own" ON public.user_powerups;
CREATE POLICY "user_powerups_select_own"
  ON public.user_powerups FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid()::text AND pr.is_admin = true
    )
  );

DROP POLICY IF EXISTS "user_powerups_update_own_available" ON public.user_powerups;
CREATE POLICY "user_powerups_update_own_available"
  ON public.user_powerups FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ---------- predictions extensions ----------
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS applied_powerup_id uuid
    REFERENCES public.user_powerups(id) ON DELETE SET NULL;

ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS is_banker_exact boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS predictions_applied_powerup_idx
  ON public.predictions (applied_powerup_id)
  WHERE applied_powerup_id IS NOT NULL;

-- ---------- Expire chips when a season deactivates ----------
CREATE OR REPLACE FUNCTION public.expire_powerups_on_season_deactivate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.is_active IS TRUE
     AND NEW.is_active IS FALSE THEN
    UPDATE public.user_powerups
    SET status = 'expired'
    WHERE sport_season_id = NEW.id
      AND status = 'available';
  END IF;
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sport_seasons_expire_powerups ON public.sport_seasons;
CREATE TRIGGER trg_sport_seasons_expire_powerups
  BEFORE UPDATE OF is_active ON public.sport_seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.expire_powerups_on_season_deactivate();

-- ---------- Football base scoring (5 / 3 / 1 / 0) ----------
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
    RETURN 5; -- Exact score
  END IF;

  predicted_margin := predicted_home - predicted_away;
  actual_margin := actual_home - actual_away;
  IF predicted_margin = actual_margin THEN
    RETURN 3; -- Exact goal difference
  END IF;

  RETURN 1; -- Correct outcome
END;
$$;

-- Rugby: Exact margin 5 · within 7 → 3 · within 10 → 1 · else 0
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

-- ---------- Power-up modifier engine ----------
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

  -- Banker: correct outcome => force exact-score points
  IF p_powerup = 'banker' THEN
    IF p_outcome_correct THEN
      v_points := EXACT_SCORE_POINTS;
      v_banker := true;
    END IF;
  -- Precision Boost (sniper): +50% on true exact hits (not banker-forced)
  ELSIF p_powerup = 'sniper' THEN
    IF p_is_exact THEN
      v_points := ROUND(v_points * 1.5)::integer;
    END IF;
  END IF;

  -- Multipliers apply after banker/sniper resolution
  IF p_powerup = 'double_bubble' THEN
    v_points := v_points * 2;
  ELSIF p_powerup = 'pitchside_master' THEN
    v_points := v_points * 3;
  END IF;

  -- Safety net: floor only when still zero
  IF p_powerup = 'safety_net' AND v_points = 0 THEN
    v_points := SAFETY_FLOOR;
  END IF;

  earned_points := v_points;
  is_banker_exact := v_banker;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.pitchside_settle_prediction_points(
  predicted_home integer,
  predicted_away integer,
  actual_home integer,
  actual_away integer,
  p_sport text,
  p_powerup public.powerup_type DEFAULT NULL
) RETURNS TABLE (earned_points integer, is_banker_exact boolean, base_points integer)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_base integer;
  v_outcome_ok boolean;
  v_exact boolean;
  v_pred_winner text;
  v_act_winner text;
  v_mod record;
BEGIN
  v_pred_winner := CASE
    WHEN predicted_home > predicted_away THEN 'home'
    WHEN predicted_home < predicted_away THEN 'away'
    ELSE 'draw'
  END;
  v_act_winner := CASE
    WHEN actual_home > actual_away THEN 'home'
    WHEN actual_home < actual_away THEN 'away'
    ELSE 'draw'
  END;
  v_outcome_ok := (v_pred_winner = v_act_winner);
  v_exact := (predicted_home = actual_home AND predicted_away = actual_away);

  IF p_sport = 'football' THEN
    v_base := public.pitchside_football_points(
      predicted_home, predicted_away, actual_home, actual_away
    );
  ELSE
    v_base := public.pitchside_rugby_points(
      predicted_home, predicted_away, actual_home, actual_away
    );
  END IF;

  SELECT * INTO v_mod
  FROM public.pitchside_apply_powerup(v_base, p_powerup, v_exact, v_outcome_ok);

  earned_points := v_mod.earned_points;
  is_banker_exact := v_mod.is_banker_exact;
  base_points := v_base;
  RETURN NEXT;
END;
$$;

-- ---------- Drop allowances (updated) ----------
CREATE OR REPLACE FUNCTION public.pitchside_competition_drops(p_competition_id text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_competition_id
    WHEN 'f-epl' THEN 3
    WHEN 'f-spfl' THEN 3
    WHEN 'f-championship' THEN 4
    ELSE 0
  END;
$$;

-- ---------- Grant baseline Double Bubble for active seasons ----------
CREATE OR REPLACE FUNCTION public.grant_baseline_double_bubble(p_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
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

-- ---------- handle_new_user: Global League + baseline chips ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dob date;
  v_nationality text;
  v_supported_team text;
  v_preferred_sport text;
  v_selected_sports jsonb;
  v_meta_sports jsonb;
  v_full_name text;
  v_first_name text;
  v_surname text;
  v_age_confirmed boolean;
  v_space int;
  v_global_league_id text;
BEGIN
  v_age_confirmed := COALESCE(
    (NEW.raw_user_meta_data->>'age_confirmed_16')::boolean,
    false
  );

  IF v_age_confirmed
     AND NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'dob', '')), '') IS NULL THEN
    v_dob := NULL;
  ELSE
    BEGIN
      v_dob := NULLIF(TRIM(NEW.raw_user_meta_data->>'dob'), '')::date;
    EXCEPTION
      WHEN invalid_datetime_format OR datetime_field_overflow THEN
        v_dob := NULL;
    END;
  END IF;

  v_nationality := NULLIF(
    TRIM(COALESCE(
      NEW.raw_user_meta_data->>'nationality',
      NEW.raw_user_meta_data->>'country',
      ''
    )),
    ''
  );

  v_supported_team := NULLIF(
    TRIM(COALESCE(
      NEW.raw_user_meta_data->>'supported_team',
      NEW.raw_user_meta_data->>'supportedTeam',
      ''
    )),
    ''
  );

  v_preferred_sport := NULLIF(
    TRIM(COALESCE(
      NEW.raw_user_meta_data->>'preferred_sport',
      NEW.raw_user_meta_data->>'preferredSport',
      ''
    )),
    ''
  );

  BEGIN
    v_meta_sports := NEW.raw_user_meta_data->'selected_sports';
  EXCEPTION
    WHEN OTHERS THEN
      v_meta_sports := NULL;
  END;

  IF v_meta_sports IS NOT NULL AND jsonb_typeof(v_meta_sports) = 'array' THEN
    v_selected_sports := v_meta_sports;
  ELSIF v_preferred_sport IS NOT NULL THEN
    v_selected_sports := jsonb_build_array(v_preferred_sport);
  ELSE
    v_selected_sports := '[]'::jsonb;
  END IF;

  v_full_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');
  v_first_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
  v_surname := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'surname'), ''), '');

  IF v_first_name IS NULL AND v_full_name IS NOT NULL THEN
    v_space := position(' ' in v_full_name);
    IF v_space > 0 THEN
      v_first_name := left(v_full_name, v_space - 1);
      v_surname := COALESCE(NULLIF(trim(substr(v_full_name, v_space + 1)), ''), '');
    ELSE
      v_first_name := v_full_name;
      v_surname := '';
    END IF;
  END IF;

  IF v_first_name IS NULL OR v_first_name = '' THEN
    v_first_name := split_part(COALESCE(NEW.email, 'player'), '@', 1);
  END IF;

  INSERT INTO public.profiles (
    id, email, first_name, surname, username, phone, dob,
    nationality, supported_team, preferred_sport, selected_sports,
    favorite_f1_team, favorite_golfer, is_verified, created_at
  )
  VALUES (
    NEW.id::text,
    NEW.email,
    v_first_name,
    v_surname,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'nickname'), ''),
      split_part(COALESCE(NEW.email, 'player'), '@', 1)
    ),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
    v_dob,
    v_nationality,
    v_supported_team,
    v_preferred_sport,
    v_selected_sports,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'favorite_f1_team', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'favorite_golfer', '')), ''),
    (NEW.email_confirmed_at IS NOT NULL),
    timezone('utc', now())
  )
  ON CONFLICT (id) DO UPDATE SET
    email           = EXCLUDED.email,
    first_name      = COALESCE(NULLIF(EXCLUDED.first_name, ''), public.profiles.first_name),
    surname         = COALESCE(NULLIF(EXCLUDED.surname, ''), public.profiles.surname),
    username        = COALESCE(EXCLUDED.username, public.profiles.username),
    phone           = COALESCE(EXCLUDED.phone, public.profiles.phone),
    dob             = COALESCE(EXCLUDED.dob, public.profiles.dob),
    nationality     = COALESCE(public.profiles.nationality, EXCLUDED.nationality),
    supported_team  = COALESCE(public.profiles.supported_team, EXCLUDED.supported_team),
    preferred_sport = COALESCE(public.profiles.preferred_sport, EXCLUDED.preferred_sport),
    selected_sports = CASE
      WHEN public.profiles.selected_sports IS NULL
        OR public.profiles.selected_sports = '[]'::jsonb
      THEN EXCLUDED.selected_sports
      ELSE public.profiles.selected_sports
    END,
    favorite_f1_team = COALESCE(public.profiles.favorite_f1_team, EXCLUDED.favorite_f1_team),
    favorite_golfer  = COALESCE(public.profiles.favorite_golfer, EXCLUDED.favorite_golfer),
    is_verified     = EXCLUDED.is_verified;

  -- Resolve Global League: prefer active-season pointer, else SYSTEM GLOBAL_LEAGUE.
  SELECT COALESCE(
    (
      SELECT ss.global_league_id
      FROM public.sport_seasons ss
      WHERE ss.is_active = true
        AND ss.global_league_id IS NOT NULL
      ORDER BY ss.updated_at DESC
      LIMIT 1
    ),
    'GLOBAL_LEAGUE'
  ) INTO v_global_league_id;

  INSERT INTO public.league_members (league_id, user_id, joined_at)
  VALUES (v_global_league_id, NEW.id::text, timezone('utc', now()))
  ON CONFLICT (league_id, user_id) DO NOTHING;

  -- Also ensure classic GLOBAL_LEAGUE membership when a season points elsewhere.
  IF v_global_league_id IS DISTINCT FROM 'GLOBAL_LEAGUE' THEN
    INSERT INTO public.league_members (league_id, user_id, joined_at)
    VALUES ('GLOBAL_LEAGUE', NEW.id::text, timezone('utc', now()))
    ON CONFLICT (league_id, user_id) DO NOTHING;
  END IF;

  PERFORM public.grant_baseline_double_bubble(NEW.id::text);

  RETURN NEW;
END;
$function$;

-- ---------- Power-up unlock evaluator ----------
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

  -- Sniper: >= 3 genuine exact scores across the user's last 10 gameweeks
  WITH last_gws AS (
    SELECT gw
    FROM (
      SELECT
        COALESCE(m.round_name, to_char(date_trunc('week', m.kickoff_time), 'IYYY-"W"IW')) AS gw,
        MAX(m.kickoff_time) AS last_ko
      FROM public.predictions p
      JOIN public.matches m ON m.id = p.match_id
      WHERE p.user_id = p_user_id
        AND p.submitted = true
        AND p.sport = p_sport_type::text
        AND m.kickoff_time IS NOT NULL
      GROUP BY 1
      ORDER BY last_ko DESC
      LIMIT 10
    ) recent_gws
  )
  SELECT COUNT(*)::int INTO v_exact_count
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id
  WHERE p.user_id = p_user_id
    AND p.submitted = true
    AND p.sport = p_sport_type::text
    AND COALESCE(p.is_banker_exact, false) = false
    AND m.status = 'completed'
    AND m.actual_home_score IS NOT NULL
    AND m.actual_away_score IS NOT NULL
    AND p.predicted_home_score = m.actual_home_score
    AND p.predicted_away_score = m.actual_away_score
    AND COALESCE(m.round_name, to_char(date_trunc('week', m.kickoff_time), 'IYYY-"W"IW')) IN (
      SELECT gw FROM last_gws
    );

  IF v_exact_count >= 3
     AND NOT EXISTS (
       SELECT 1 FROM public.user_powerups
       WHERE user_id = p_user_id
         AND sport_season_id = v_season_id
         AND powerup_type = 'sniper'
         AND status IN ('available', 'used')
     ) THEN
    INSERT INTO public.user_powerups (
      user_id, powerup_type, sport_type, sport_season_id, status, earned_at
    ) VALUES (
      p_user_id, 'sniper', p_sport_type, v_season_id, 'available', timezone('utc', now())
    );
    v_granted := array_append(v_granted, 'sniper');
  END IF;

  -- Safety net: 3 consecutive calendar weeks with a submitted prediction
  WITH weeks AS (
    SELECT DISTINCT date_trunc('week', m.kickoff_time)::date AS week_start
    FROM public.predictions p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.user_id = p_user_id
      AND p.submitted = true
      AND p.sport = p_sport_type::text
      AND m.kickoff_time IS NOT NULL
  ),
  ordered AS (
    SELECT
      week_start,
      week_start + ((ROW_NUMBER() OVER (ORDER BY week_start DESC) - 1) * 7) AS expected
    FROM weeks
  )
  SELECT COUNT(*)::int INTO v_streak
  FROM ordered
  WHERE week_start = expected;

  IF v_streak >= 3
     AND NOT EXISTS (
       SELECT 1 FROM public.user_powerups
       WHERE user_id = p_user_id
         AND sport_season_id = v_season_id
         AND powerup_type = 'safety_net'
         AND status = 'available'
     ) THEN
    INSERT INTO public.user_powerups (
      user_id, powerup_type, sport_type, sport_season_id, status, earned_at
    ) VALUES (
      p_user_id, 'safety_net', p_sport_type, v_season_id, 'available', timezone('utc', now())
    );
    v_granted := array_append(v_granted, 'safety_net');
  END IF;

  -- PitchSide Master: 8 consecutive weeks across 2+ sports at >= 65% accuracy
  WITH weeks AS (
    SELECT DISTINCT date_trunc('week', m.kickoff_time)::date AS week_start
    FROM public.predictions p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.user_id = p_user_id
      AND p.submitted = true
      AND m.kickoff_time IS NOT NULL
      AND m.kickoff_time >= (timezone('utc', now()) - interval '70 days')
  ),
  ordered AS (
    SELECT
      week_start,
      week_start + ((ROW_NUMBER() OVER (ORDER BY week_start DESC) - 1) * 7) AS expected
    FROM weeks
  )
  SELECT COUNT(*)::int INTO v_streak
  FROM ordered
  WHERE week_start = expected;

  SELECT COUNT(DISTINCT p.sport)::int INTO v_multi_sports
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id
  WHERE p.user_id = p_user_id
    AND p.submitted = true
    AND m.kickoff_time >= (timezone('utc', now()) - interval '70 days');

  SELECT
    COALESCE(SUM(
      CASE
        WHEN m.status = 'completed'
          AND m.actual_home_score IS NOT NULL
          AND m.actual_away_score IS NOT NULL
          AND (
            CASE
              WHEN p.sport = 'football' THEN public.pitchside_football_points(
                p.predicted_home_score, p.predicted_away_score,
                m.actual_home_score, m.actual_away_score
              )
              ELSE public.pitchside_rugby_points(
                p.predicted_home_score, p.predicted_away_score,
                m.actual_home_score, m.actual_away_score
              )
            END
          ) > 0
        THEN 1 ELSE 0
      END
    ), 0),
    COALESCE(SUM(
      CASE
        WHEN m.status = 'completed'
          AND m.actual_home_score IS NOT NULL
          AND m.actual_away_score IS NOT NULL
        THEN 1 ELSE 0
      END
    ), 0)
  INTO v_hits, v_total
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id
  WHERE p.user_id = p_user_id
    AND p.submitted = true
    AND m.kickoff_time >= (timezone('utc', now()) - interval '70 days');

  IF v_total > 0 THEN
    v_accuracy := (v_hits::numeric / v_total::numeric) * 100;
  ELSE
    v_accuracy := 0;
  END IF;

  IF v_streak >= 8
     AND v_multi_sports >= 2
     AND v_accuracy >= 65
     AND NOT EXISTS (
       SELECT 1 FROM public.user_powerups
       WHERE user_id = p_user_id
         AND sport_season_id = v_season_id
         AND powerup_type = 'pitchside_master'
         AND status IN ('available', 'used')
     ) THEN
    INSERT INTO public.user_powerups (
      user_id, powerup_type, sport_type, sport_season_id, status, earned_at
    ) VALUES (
      p_user_id, 'pitchside_master', p_sport_type, v_season_id, 'available', timezone('utc', now())
    );
    v_granted := array_append(v_granted, 'pitchside_master');
  END IF;

  RETURN jsonb_build_object(
    'granted', to_jsonb(v_granted),
    'season_id', v_season_id,
    'exact_count', v_exact_count,
    'submission_streak_weeks', v_streak,
    'accuracy_pct', v_accuracy,
    'multi_sports', v_multi_sports
  );
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_powerup_unlocks(text, public.powerup_sport_type, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_powerup_unlocks(text, public.powerup_sport_type, uuid) TO authenticated, service_role;

-- ---------- Competition leaderboard with drop weeks ----------
CREATE OR REPLACE FUNCTION public.get_competition_leaderboard(
  p_competition_id text,
  p_season_id text DEFAULT NULL
)
RETURNS TABLE (
  player_id text,
  nickname text,
  official_score bigint,
  ghost_points bigint,
  gameweeks_played integer,
  drops_allowed integer,
  drops_used integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH scored AS (
    SELECT
      pred.user_id,
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
      AND COALESCE(m.competition_id, pred.competition_id) = p_competition_id
      AND m.status = 'completed'
      AND m.actual_home_score IS NOT NULL
      AND m.actual_away_score IS NOT NULL
      AND (p_season_id IS NULL OR pred.season = p_season_id)
  ),
  by_week AS (
    SELECT user_id, gameweek_key, SUM(points)::integer AS week_points
    FROM scored
    GROUP BY user_id, gameweek_key
  ),
  ranked AS (
    SELECT
      user_id,
      week_points,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY week_points ASC, gameweek_key) AS rn_asc,
      COUNT(*) OVER (PARTITION BY user_id) AS weeks_played
    FROM by_week
  ),
  agg AS (
    SELECT
      r.user_id,
      MAX(r.weeks_played)::integer AS gameweeks_played,
      public.pitchside_competition_drops(p_competition_id) AS drops_allowed,
      CASE
        WHEN MAX(r.weeks_played) > public.pitchside_competition_drops(p_competition_id)
        THEN public.pitchside_competition_drops(p_competition_id)
        ELSE 0
      END::integer AS drops_used,
      SUM(r.week_points)::bigint AS ghost_points,
      SUM(
        CASE
          WHEN r.weeks_played > public.pitchside_competition_drops(p_competition_id)
               AND r.rn_asc <= public.pitchside_competition_drops(p_competition_id)
          THEN 0
          ELSE r.week_points
        END
      )::bigint AS official_score
    FROM ranked r
    GROUP BY r.user_id
  )
  SELECT
    a.user_id AS player_id,
    COALESCE(p.username, 'Player') AS nickname,
    a.official_score,
    a.ghost_points,
    a.gameweeks_played,
    a.drops_allowed,
    a.drops_used
  FROM agg a
  JOIN public.profiles p ON p.id = a.user_id
  ORDER BY a.official_score DESC, a.ghost_points DESC, nickname ASC;
$$;

-- ---------- Rugby leaderboard (no drops) ----------
CREATE OR REPLACE FUNCTION public.get_rugby_leaderboard(
  p_competition_id text,
  p_season_id text DEFAULT NULL
)
RETURNS TABLE (
  player_id text,
  nickname text,
  official_score bigint,
  ghost_points bigint,
  gameweeks_played integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH scored AS (
    SELECT
      pred.user_id,
      COALESCE(m.round_name, to_char(date_trunc('week', m.kickoff_time), 'IYYY-"W"IW')) AS gameweek_key,
      (
        SELECT s.earned_points
        FROM public.pitchside_settle_prediction_points(
          pred.predicted_home_score,
          pred.predicted_away_score,
          m.actual_home_score,
          m.actual_away_score,
          'rugby',
          up.powerup_type
        ) s
      ) AS points
    FROM public.predictions pred
    JOIN public.matches m ON m.id = pred.match_id
    LEFT JOIN public.user_powerups up ON up.id = pred.applied_powerup_id
    WHERE pred.submitted = true
      AND pred.sport = 'rugby'
      AND COALESCE(m.competition_id, pred.competition_id) = p_competition_id
      AND m.status = 'completed'
      AND m.actual_home_score IS NOT NULL
      AND m.actual_away_score IS NOT NULL
      AND (p_season_id IS NULL OR pred.season = p_season_id)
  ),
  by_week AS (
    SELECT user_id, gameweek_key, SUM(points)::integer AS week_points
    FROM scored
    GROUP BY user_id, gameweek_key
  ),
  agg AS (
    SELECT
      user_id,
      COUNT(*)::integer AS gameweeks_played,
      SUM(week_points)::bigint AS official_score
    FROM by_week
    GROUP BY user_id
  )
  SELECT
    a.user_id AS player_id,
    COALESCE(p.username, 'Player') AS nickname,
    a.official_score,
    a.official_score AS ghost_points,
    a.gameweeks_played
  FROM agg a
  JOIN public.profiles p ON p.id = a.user_id
  ORDER BY a.official_score DESC, nickname ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_competition_leaderboard(text, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_rugby_leaderboard(text, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.pitchside_settle_prediction_points(integer, integer, integer, integer, text, public.powerup_type) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_baseline_double_bubble(text) TO service_role;

COMMENT ON TABLE public.user_powerups IS
  'Season-scoped power-up inventory. Available chips expire when sport_seasons.is_active becomes false.';
COMMENT ON FUNCTION public.evaluate_powerup_unlocks(text, public.powerup_sport_type, uuid) IS
  'Post-settlement unlock checks for sniper, safety_net, and pitchside_master.';
