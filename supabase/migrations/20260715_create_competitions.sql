-- ============================================================================
-- 20260715_create_competitions.sql
-- ----------------------------------------------------------------------------
-- Creates a database-backed home for admin-created competitions.
--
-- Today the Competitions tab (src/components/admin/CompetitionsManager.tsx)
-- only writes to the in-memory/localStorage competitions module, so custom
-- competitions do not persist or sync across devices. This table is the future
-- source of truth. The UI is intentionally NOT wired to it yet — this migration
-- just prepares the schema.
--
-- SAFETY: Fully idempotent and non-destructive (CREATE TABLE IF NOT EXISTS,
-- CREATE INDEX IF NOT EXISTS, DROP POLICY IF EXISTS + CREATE POLICY).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.custom_competitions (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    sport      TEXT NOT NULL,           -- 'football' | 'rugby'
    season     TEXT DEFAULT '2026',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS custom_competitions_sport_idx  ON public.custom_competitions (sport);
CREATE INDEX IF NOT EXISTS custom_competitions_season_idx ON public.custom_competitions (season);

-- ---- Row-Level Security -----------------------------------------------------
-- Competitions are public reference data: readable by everyone, writable via
-- the admin tools. Writes are gated in the app to admins; the permissive write
-- policy mirrors the pattern used by the base schema tables.
ALTER TABLE public.custom_competitions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_competitions TO anon, authenticated;

DROP POLICY IF EXISTS "custom_competitions read" ON public.custom_competitions;
CREATE POLICY "custom_competitions read"
    ON public.custom_competitions
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "custom_competitions write" ON public.custom_competitions;
CREATE POLICY "custom_competitions write"
    ON public.custom_competitions
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
