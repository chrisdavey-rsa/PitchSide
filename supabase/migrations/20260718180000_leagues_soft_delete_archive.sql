-- Soft-delete / archive model for leagues (avoids FK hard-delete failures).
-- Archived leagues are hidden from player-facing browse/join/membership UIs.

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leagues.is_archived IS
  'When true, league is archived (soft-deleted). Hidden from normal users; visible in Admin Archived view.';

CREATE INDEX IF NOT EXISTS leagues_is_archived_idx
  ON public.leagues (is_archived)
  WHERE is_archived = false;
