-- ============================================================================
-- PitchSide — Schema Reconciliation
-- ----------------------------------------------------------------------------
-- Brings the live database in line with what the frontend (src/supabase.ts,
-- src/components/auth/authSession.ts and the admin components) already expects.
--
-- SAFETY: This script is 100% idempotent and non-destructive. It only ADDS
-- objects (tables, columns, functions, policies) and never drops or truncates
-- data. Every statement guards with IF NOT EXISTS / IF EXISTS or CREATE OR
-- REPLACE, so it is safe to run repeatedly against production.
--
-- Reconciled in this migration:
--   1. public.league_members            (table + foreign keys + index)
--   2. public.leagues                   (is_public, max_participants, season)
--   3. public.matches                   (match_tag)
--   4. public.power_up_wallet           (new table for power-up inventory)
--   5. public.get_email_by_nickname()   (login nickname -> email RPC)
--   6. Row-Level Security for the new tables
-- ============================================================================


-- ============================================================================
-- 1. LEAGUE MEMBERS
-- ----------------------------------------------------------------------------
-- Join table mapping players to the leagues they belong to. The frontend reads
-- it directly (dbJoinLeague / dbLeaveLeague / dbFetchUserLeagues /
-- dbFetchLeaguesMembership / dbFetchLeagueMembers) and relies on PostgREST
-- embedding, i.e. `select('league_id, leagues (*)')` and
-- `select('user_id, profiles (*)')`, which requires real foreign keys.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.league_members (
    league_id TEXT NOT NULL,
    user_id   TEXT NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    CONSTRAINT league_members_pkey PRIMARY KEY (league_id, user_id)
);

-- Foreign keys (added only if an equivalent FK is not already present, so we
-- never create a duplicate relationship that would make PostgREST embeds
-- ambiguous). Checked by the exact key column rather than by constraint name.
DO $$
BEGIN
    -- league_id -> leagues.id
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conrelid = 'public.league_members'::regclass
          AND c.contype = 'f'
          AND c.conkey = ARRAY[(
              SELECT attnum FROM pg_attribute
              WHERE attrelid = 'public.league_members'::regclass
                AND attname = 'league_id'
          )]
    ) THEN
        ALTER TABLE public.league_members
            ADD CONSTRAINT league_members_league_id_fkey
            FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE CASCADE;
    END IF;

    -- user_id -> profiles.id
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conrelid = 'public.league_members'::regclass
          AND c.contype = 'f'
          AND c.conkey = ARRAY[(
              SELECT attnum FROM pg_attribute
              WHERE attrelid = 'public.league_members'::regclass
                AND attname = 'user_id'
          )]
    ) THEN
        ALTER TABLE public.league_members
            ADD CONSTRAINT league_members_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Speeds up "all leagues for a user" and membership lookups.
CREATE INDEX IF NOT EXISTS league_members_user_id_idx  ON public.league_members (user_id);
CREATE INDEX IF NOT EXISTS league_members_league_id_idx ON public.league_members (league_id);


-- ============================================================================
-- 2. LEAGUES — MISSING COLUMNS
-- ----------------------------------------------------------------------------
-- dbFetchLeagues / dbFetchUserLeagues read is_public, max_participants and
-- season; dbUpdateLeagueSettings writes is_public and max_participants.
-- ============================================================================
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS is_public        BOOLEAN DEFAULT false;
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS max_participants INTEGER;
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS season           TEXT;


-- ============================================================================
-- 3. MATCHES — HIGH STAKES TAG
-- ----------------------------------------------------------------------------
-- Optional premium fixture label surfaced in the UI ("Barrage Bout", "Derby",
-- "Cup Run"). Nullable so existing fixtures are unaffected.
-- ============================================================================
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS match_tag TEXT;


-- ============================================================================
-- 4. POWER-UP WALLET
-- ----------------------------------------------------------------------------
-- Tracks each player's power-up inventory (e.g. 'urc-shield-bank',
-- 'ucl-joker'). `quantity` covers stackable charges (URC Shield Banks) and
-- `assigned_team` covers targeted power-ups (UCL Joker: Arsenal). One row per
-- (user, power-up, season).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.power_up_wallet (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    power_up_id   TEXT NOT NULL,          -- matches ids in src/data/powerUps.ts
    quantity      INTEGER DEFAULT 0,      -- available charges of this power-up
    assigned_team TEXT,                   -- nominated team, e.g. for the Joker
    is_active     BOOLEAN DEFAULT false,  -- currently armed/deployed this round
    season        TEXT DEFAULT '2026',
    created_at    TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at    TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    CONSTRAINT power_up_wallet_user_powerup_season_uniq
        UNIQUE (user_id, power_up_id, season)
);

CREATE INDEX IF NOT EXISTS power_up_wallet_user_id_idx ON public.power_up_wallet (user_id);


-- ============================================================================
-- 5. RPC: get_email_by_nickname
-- ----------------------------------------------------------------------------
-- Login accepts a username OR email. resolveEmailFromNickname() calls this
-- RPC (before the user is authenticated) to turn a nickname into the email
-- required by supabase.auth.signInWithPassword. Nicknames are stored in
-- profiles.username. SECURITY DEFINER + explicit search_path so it resolves
-- reliably regardless of the caller's role.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_email_by_nickname(search_nickname text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT email
    FROM public.profiles
    WHERE lower(username) = lower(trim(search_nickname))
      AND username NOT LIKE 'freed_nick_%'
    LIMIT 1;
$$;

-- Callable pre-auth (login screen) and post-auth.
GRANT EXECUTE ON FUNCTION public.get_email_by_nickname(text) TO anon, authenticated;


-- ============================================================================
-- 6. ROW-LEVEL SECURITY (new tables only)
-- ----------------------------------------------------------------------------
-- league_members: membership is public so league standings / the "My League"
--   leaderboard can be read by anyone, but a player may only add or remove
--   THEIR OWN membership (auth.uid() must match user_id).
-- power_up_wallet: strictly private — a player can only see and modify their
--   own inventory.
--
-- NOTE ON AUTH: these write policies assume league joins/leaves happen inside
-- an authenticated Supabase session (they do — login uses
-- auth.signInWithPassword, and profiles.id equals the auth uid). If you ever
-- need unauthenticated writes, swap the write policies for the permissive
-- variant included in comments at the bottom of this file.
-- ============================================================================

ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.power_up_wallet ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_members TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.power_up_wallet TO anon, authenticated;

-- ---- league_members policies -------------------------------------------------
DROP POLICY IF EXISTS "league_members read" ON public.league_members;
CREATE POLICY "league_members read"
    ON public.league_members
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "league_members join self" ON public.league_members;
CREATE POLICY "league_members join self"
    ON public.league_members
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "league_members leave self" ON public.league_members;
CREATE POLICY "league_members leave self"
    ON public.league_members
    FOR DELETE
    TO authenticated
    USING (auth.uid()::text = user_id);

-- ---- power_up_wallet policies ------------------------------------------------
DROP POLICY IF EXISTS "power_up_wallet owner read" ON public.power_up_wallet;
CREATE POLICY "power_up_wallet owner read"
    ON public.power_up_wallet
    FOR SELECT
    TO authenticated
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "power_up_wallet owner write" ON public.power_up_wallet;
CREATE POLICY "power_up_wallet owner write"
    ON public.power_up_wallet
    FOR ALL
    TO authenticated
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);


-- ============================================================================
-- OPTIONAL: permissive fallback for league_members writes
-- ----------------------------------------------------------------------------
-- Only use this if your app writes league_members WITHOUT an authenticated
-- session (the secure policies above would block those writes). Uncomment to
-- mirror the permissive pattern used by the base schema:
--
-- DROP POLICY IF EXISTS "league_members join self"  ON public.league_members;
-- DROP POLICY IF EXISTS "league_members leave self" ON public.league_members;
-- DROP POLICY IF EXISTS "league_members write any"  ON public.league_members;
-- CREATE POLICY "league_members write any"
--     ON public.league_members
--     FOR ALL
--     TO anon, authenticated
--     USING (true)
--     WITH CHECK (true);
-- ============================================================================
