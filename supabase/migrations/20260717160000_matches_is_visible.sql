-- PitchSide: admin opt-out visibility for fixtures.
-- When is_visible is false, player-facing fetches hide the match;
-- admin fetches continue to return all rows.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.matches.is_visible IS
  'Admin visibility override. false = hidden from player prediction feeds; default true (visible).';

CREATE INDEX IF NOT EXISTS matches_is_visible_idx
  ON public.matches (is_visible)
  WHERE is_visible = true;
