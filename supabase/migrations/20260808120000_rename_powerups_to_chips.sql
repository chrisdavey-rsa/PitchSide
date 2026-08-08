-- Rename Power-ups → Chips (types, tables, columns, RPCs, trigger).
-- Function bodies are captured + rewritten before object renames, then recreated.

CREATE TEMP TABLE _chip_fn_rebuild AS
SELECT
  p.proname AS old_name,
  CASE p.proname
    WHEN 'pitchside_apply_powerup' THEN 1
    WHEN 'pitchside_settle_prediction_points' THEN 2
    WHEN 'expire_powerups_on_season_deactivate' THEN 3
    ELSE 10
  END AS create_order,
  replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
    pg_get_functiondef(p.oid),
    'pitchside_apply_powerup', 'pitchside_apply_chip'),
    'evaluate_powerup_unlocks', 'evaluate_chip_unlocks'),
    'expire_powerups_on_season_deactivate', 'expire_chips_on_season_deactivate'),
    'get_player_powerup_usage', 'get_player_chip_usage'),
    'powerup_sport_type', 'chip_sport_type'),
    'powerup_status', 'chip_status'),
    'powerup_type', 'chip_type'),
    'user_powerups', 'user_chips'),
    'applied_powerup_id', 'applied_chip_id'),
    'power_up_wallet', 'chip_wallet'),
    'p_powerup_id', 'p_chip_id'),
    'p_powerup', 'p_chip'),
    'v_powerup', 'v_chip'),
    'power_up_id', 'chip_id'),
    'Power-up', 'Chip'),
    'Power-Up', 'Chip'),
    'power-up', 'chip') AS new_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%power%'
    OR pg_get_functiondef(p.oid) ILIKE '%user_powerups%'
    OR pg_get_functiondef(p.oid) ILIKE '%applied_powerup%'
    OR pg_get_functiondef(p.oid) ILIKE '%pitchside_apply_powerup%'
    OR pg_get_functiondef(p.oid) ILIKE '%powerup_type%'
  );

DROP TRIGGER IF EXISTS trg_sport_seasons_expire_powerups ON public.sport_seasons;
DROP TRIGGER IF EXISTS trg_predictions_enforce_lock_time ON public.predictions;

DROP FUNCTION IF EXISTS public.evaluate_powerup_unlocks(text, public.powerup_sport_type, uuid);
DROP FUNCTION IF EXISTS public.expire_powerups_on_season_deactivate();
DROP FUNCTION IF EXISTS public.get_player_powerup_usage(text);
DROP FUNCTION IF EXISTS public.pitchside_settle_prediction_points(integer, integer, integer, integer, text, public.powerup_type);
DROP FUNCTION IF EXISTS public.pitchside_apply_powerup(integer, public.powerup_type, boolean, boolean);
DROP FUNCTION IF EXISTS public.pitchside_lock_prediction(text, text, text, text, integer, integer, uuid);
DROP FUNCTION IF EXISTS public.force_resettle_match(text, integer, integer);
DROP FUNCTION IF EXISTS public.get_competition_leaderboard(text, text);
DROP FUNCTION IF EXISTS public.get_global_leaderboard(text);
DROP FUNCTION IF EXISTS public.get_global_leaderboard_horizon(text, text);
DROP FUNCTION IF EXISTS public.get_league_member_predictions(text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.get_rugby_leaderboard(text, text);
DROP FUNCTION IF EXISTS public.grant_baseline_double_bubble(text);
DROP FUNCTION IF EXISTS public.enforce_prediction_lock_time();

ALTER TYPE public.powerup_type RENAME TO chip_type;
ALTER TYPE public.powerup_status RENAME TO chip_status;
ALTER TYPE public.powerup_sport_type RENAME TO chip_sport_type;

ALTER TABLE public.user_powerups RENAME TO user_chips;
ALTER TABLE public.user_chips RENAME COLUMN powerup_type TO chip_type;

ALTER TABLE public.power_up_wallet RENAME TO chip_wallet;
ALTER TABLE public.chip_wallet RENAME COLUMN power_up_id TO chip_id;

ALTER TABLE public.predictions RENAME COLUMN applied_powerup_id TO applied_chip_id;

ALTER INDEX IF EXISTS public.user_powerups_user_season_idx RENAME TO user_chips_user_season_idx;
ALTER INDEX IF EXISTS public.user_powerups_type_season_idx RENAME TO user_chips_type_season_idx;
ALTER INDEX IF EXISTS public.user_powerups_one_available_per_type RENAME TO user_chips_one_available_per_type;

ALTER TABLE public.user_chips RENAME CONSTRAINT user_powerups_pkey TO user_chips_pkey;
ALTER TABLE public.user_chips RENAME CONSTRAINT user_powerups_user_id_fkey TO user_chips_user_id_fkey;
ALTER TABLE public.user_chips RENAME CONSTRAINT user_powerups_sport_season_id_fkey TO user_chips_sport_season_id_fkey;
ALTER TABLE public.user_chips RENAME CONSTRAINT user_powerups_applied_fixture_id_fkey TO user_chips_applied_fixture_id_fkey;
ALTER TABLE public.user_chips RENAME CONSTRAINT user_powerups_used_requires_fixture TO user_chips_used_requires_fixture;

ALTER TABLE public.chip_wallet RENAME CONSTRAINT power_up_wallet_pkey TO chip_wallet_pkey;
ALTER TABLE public.chip_wallet RENAME CONSTRAINT power_up_wallet_user_id_fkey TO chip_wallet_user_id_fkey;
ALTER TABLE public.chip_wallet RENAME CONSTRAINT power_up_wallet_user_powerup_season_uniq TO chip_wallet_user_chip_season_uniq;

ALTER TABLE public.predictions RENAME CONSTRAINT predictions_applied_powerup_id_fkey TO predictions_applied_chip_id_fkey;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT new_def
    FROM _chip_fn_rebuild
    ORDER BY create_order, old_name
  LOOP
    EXECUTE r.new_def;
  END LOOP;
END $$;

CREATE TRIGGER trg_sport_seasons_expire_chips
  BEFORE UPDATE OF is_active ON public.sport_seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.expire_chips_on_season_deactivate();

CREATE TRIGGER trg_predictions_enforce_lock_time
  BEFORE INSERT OR UPDATE ON public.predictions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_prediction_lock_time();

-- Restore EXECUTE grants lost when functions were dropped/recreated.
GRANT EXECUTE ON FUNCTION public.evaluate_chip_unlocks(text, public.chip_sport_type, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_player_chip_usage(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pitchside_apply_chip(integer, public.chip_type, boolean, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pitchside_lock_prediction(text, text, text, text, integer, integer, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pitchside_settle_prediction_points(integer, integer, integer, integer, text, public.chip_type) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_baseline_double_bubble(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_global_leaderboard(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_global_leaderboard_horizon(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_competition_leaderboard(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_rugby_leaderboard(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_league_member_predictions(text, timestamp with time zone) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.force_resettle_match(text, integer, integer) TO service_role;

DROP TABLE IF EXISTS _chip_fn_rebuild;
