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

-- Enable RLS and setup permissive policies for sandbox mode
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unsubscribed_emails ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Allow raw read for profiles" ON public.profiles FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow any write for profiles" ON public.profiles FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Predictions Policies
CREATE POLICY "Allow raw read for predictions" ON public.predictions FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow any write for predictions" ON public.predictions FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Leagues Policies
CREATE POLICY "Allow raw read for leagues" ON public.leagues FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow any write for leagues" ON public.leagues FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Archived Players Policies
CREATE POLICY "Allow raw read for archived_players" ON public.archived_players FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow any write for archived_players" ON public.archived_players FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Unsubscribed Emails Policies
CREATE POLICY "Allow raw read for unsubscribed_emails" ON public.unsubscribed_emails FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow any write for unsubscribed_emails" ON public.unsubscribed_emails FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
