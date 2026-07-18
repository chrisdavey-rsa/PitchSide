-- =============================================================================
-- Persistent onboarding / feature-tour flags on profiles
-- -----------------------------------------------------------------------------
-- Replaces localStorage-only walkthrough gating (breaks on new devices).
-- JSONB map so future sport tutorials can be added without new columns, e.g.:
--   { "main_walkthrough": true, "football_intro": true, "golf_tutorial": true }
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seen_features jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.seen_features IS
  'Map of feature keys the user has already seen (main_walkthrough, football_intro, golf_tutorial, …).';

-- Returning / pre-existing accounts: never re-show the main dashboard walkthrough.
UPDATE public.profiles
SET seen_features = COALESCE(seen_features, '{}'::jsonb) || '{"main_walkthrough": true}'::jsonb
WHERE NOT (COALESCE(seen_features, '{}'::jsonb) ? 'main_walkthrough');
