-- PitchSide base schema.
-- This migration is fully idempotent: it can be re-run against an existing
-- database without error (tables use IF NOT EXISTS, columns use ADD COLUMN
-- IF NOT EXISTS, and policies are dropped before being recreated).

-- ==========================================================================
-- TABLES
-- ==========================================================================

-- Create unsubscribed_emails table
CREATE TABLE IF NOT EXISTS public.unsubscribed_emails (
    email TEXT PRIMARY KEY,
    unsubscribed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    user_id TEXT,
    nickname TEXT
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    first_name TEXT,
    surname TEXT,
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    dob TEXT,
    nationality TEXT,
    supported_team TEXT,
    is_admin BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Columns added after the original release (safe no-ops if already present).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_sport TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_profile_public BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Create predictions table
CREATE TABLE IF NOT EXISTS public.predictions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    match_id TEXT NOT NULL,
    sport TEXT NOT NULL,
    competition_id TEXT,
    season TEXT DEFAULT '2026',
    predicted_home_score INTEGER NOT NULL,
    predicted_away_score INTEGER NOT NULL,
    submitted BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- points_won is written by the admin scoring tools; add it if missing.
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS points_won INTEGER;

-- Create matches table (source of truth for fixtures and final scores)
CREATE TABLE IF NOT EXISTS public.matches (
    id TEXT PRIMARY KEY,
    competition_id TEXT,
    sport TEXT,
    home_team TEXT,
    away_team TEXT,
    actual_home_score INTEGER,
    actual_away_score INTEGER,
    kickoff_time TIMESTAMPTZ,
    status TEXT DEFAULT 'upcoming',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Create leagues table
CREATE TABLE IF NOT EXISTS public.leagues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password TEXT DEFAULT '',
    competition_id TEXT,
    creator_id TEXT,
    creator_name TEXT,
    members JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Create archived_players table
CREATE TABLE IF NOT EXISTS public.archived_players (
    id TEXT PRIMARY KEY,
    deleted_user TEXT,
    predictions TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ==========================================================================
-- ROW LEVEL SECURITY
-- ==========================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unsubscribed_emails ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Allow raw read for profiles" ON public.profiles;
CREATE POLICY "Allow raw read for profiles" ON public.profiles FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "Allow any write for profiles" ON public.profiles;
CREATE POLICY "Allow any write for profiles" ON public.profiles FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Predictions Policies
DROP POLICY IF EXISTS "Allow raw read for predictions" ON public.predictions;
CREATE POLICY "Allow raw read for predictions" ON public.predictions FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "Allow any write for predictions" ON public.predictions;
CREATE POLICY "Allow any write for predictions" ON public.predictions FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Matches Policies
DROP POLICY IF EXISTS "Allow raw read for matches" ON public.matches;
CREATE POLICY "Allow raw read for matches" ON public.matches FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "Allow any write for matches" ON public.matches;
CREATE POLICY "Allow any write for matches" ON public.matches FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Leagues Policies
DROP POLICY IF EXISTS "Allow raw read for leagues" ON public.leagues;
CREATE POLICY "Allow raw read for leagues" ON public.leagues FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "Allow any write for leagues" ON public.leagues;
CREATE POLICY "Allow any write for leagues" ON public.leagues FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Archived Players Policies
DROP POLICY IF EXISTS "Allow raw read for archived_players" ON public.archived_players;
CREATE POLICY "Allow raw read for archived_players" ON public.archived_players FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "Allow any write for archived_players" ON public.archived_players;
CREATE POLICY "Allow any write for archived_players" ON public.archived_players FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Unsubscribed Emails Policies
DROP POLICY IF EXISTS "Allow raw read for unsubscribed_emails" ON public.unsubscribed_emails;
CREATE POLICY "Allow raw read for unsubscribed_emails" ON public.unsubscribed_emails FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "Allow any write for unsubscribed_emails" ON public.unsubscribed_emails;
CREATE POLICY "Allow any write for unsubscribed_emails" ON public.unsubscribed_emails FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
