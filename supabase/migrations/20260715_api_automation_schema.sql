-- ============================================================================
-- 20260715_api_automation_schema.sql
-- ----------------------------------------------------------------------------
-- Prepares the schema to ingest rich live data from API-Sports and to power the
-- "As It Stands" live prediction experience and automated point multipliers.
--
--   * matches      -> round/venue metadata, pre-match odds, a base point
--                     multiplier, and provisional (in-play) score + minute.
--   * predictions  -> provisional_points, the live running score a prediction
--                     is currently tracking before the match is settled.
--
-- SAFETY: Fully idempotent and non-destructive (ADD COLUMN IF NOT EXISTS only).
-- Safe to run repeatedly against production.
-- ============================================================================

-- ---- matches: fixture metadata, odds & live scoring --------------------------
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS round_name              TEXT;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS venue_name              TEXT;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS odds_home_win           NUMERIC;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS odds_draw               NUMERIC;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS odds_away_win           NUMERIC;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS base_multiplier         NUMERIC DEFAULT 1.0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS provisional_home_score  INTEGER;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS provisional_away_score  INTEGER;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS match_minute            TEXT;

-- ---- predictions: live provisional scoring ----------------------------------
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS provisional_points  INTEGER DEFAULT 0;
