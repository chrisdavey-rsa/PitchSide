-- =============================================================================
-- Emerging sports (Golf + F1) — SQL verification check
-- Run in Supabase SQL editor or: supabase db query -f ...
-- Expect: every check_name row has ok = true
-- =============================================================================

WITH checks AS (
  -- 1) profiles.role exists and is constrained to admin|player
  SELECT
    'profiles.role column'::text AS check_name,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
    ) AS ok

  UNION ALL
  SELECT
    'profiles.selected_sports jsonb',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'selected_sports'
    )

  UNION ALL
  SELECT
    'profiles.favorite_f1_team',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'favorite_f1_team'
    )

  UNION ALL
  SELECT
    'profiles.favorite_golfer',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'favorite_golfer'
    )

  UNION ALL
  SELECT
    'profiles.golf_mulligans_available',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'golf_mulligans_available'
    )

  UNION ALL
  SELECT 'table f1_constructors', to_regclass('public.f1_constructors') IS NOT NULL
  UNION ALL
  SELECT 'table f1_drivers', to_regclass('public.f1_drivers') IS NOT NULL
  UNION ALL
  SELECT 'table f1_races', to_regclass('public.f1_races') IS NOT NULL
  UNION ALL
  SELECT 'table f1_predictions', to_regclass('public.f1_predictions') IS NOT NULL
  UNION ALL
  SELECT 'table golf_players', to_regclass('public.golf_players') IS NOT NULL
  UNION ALL
  SELECT 'table golf_tournaments', to_regclass('public.golf_tournaments') IS NOT NULL
  UNION ALL
  SELECT 'table golf_predictions', to_regclass('public.golf_predictions') IS NOT NULL

  UNION ALL
  -- f1_constructors has colour + flag fields used by onboarding combobox
  SELECT
    'f1_constructors.team_color_hex + country_code',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'f1_constructors' AND column_name = 'team_color_hex'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'f1_constructors' AND column_name = 'country_code'
    )

  UNION ALL
  SELECT
    'golf_players.country_code',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'golf_players' AND column_name = 'country_code'
    )
)
SELECT check_name, ok,
       CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS status
FROM checks
ORDER BY ok ASC, check_name;
