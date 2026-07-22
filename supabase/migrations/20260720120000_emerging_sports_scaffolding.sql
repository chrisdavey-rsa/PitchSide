-- Emerging sports profile columns + seed catalog (idempotent).
-- Does NOT alter football/rugby match or prediction tables.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS selected_sports jsonb DEFAULT '["football","rugby"]'::jsonb,
  ADD COLUMN IF NOT EXISTS favorite_f1_team text,
  ADD COLUMN IF NOT EXISTS favorite_golfer text,
  ADD COLUMN IF NOT EXISTS golf_mulligans_available integer DEFAULT 0;

-- Backfill role from is_admin where still null
UPDATE public.profiles
SET role = CASE WHEN COALESCE(is_admin, false) THEN 'admin' ELSE 'player' END
WHERE role IS NULL OR role = '';

-- Soft-constrain role values (drop/recreate to stay idempotent)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IS NULL OR role IN ('admin', 'player'));

COMMENT ON COLUMN public.profiles.role IS
  'Access tier for emerging sports: admin (full Golf/F1) or player (coming-soon).';
COMMENT ON COLUMN public.profiles.selected_sports IS
  'JSON array of preferred sport keys: football, rugby, golf, formula1.';
COMMENT ON COLUMN public.profiles.golf_mulligans_available IS
  'Remaining Mulligan power-ups for Golf Majors.';

-- Catalog tables (create if a fresh env is missing them)
CREATE TABLE IF NOT EXISTS public.f1_constructors (
  id text PRIMARY KEY,
  name text NOT NULL,
  nationality text,
  country_code varchar(8),
  team_color_hex varchar(16)
);

CREATE TABLE IF NOT EXISTS public.f1_drivers (
  id text PRIMARY KEY,
  name text NOT NULL,
  permanent_number integer,
  constructor_id text REFERENCES public.f1_constructors (id),
  nationality text,
  country_code varchar(8),
  helmet_image_url text
);

CREATE TABLE IF NOT EXISTS public.golf_players (
  id text PRIMARY KEY,
  name text NOT NULL,
  nationality text,
  country_code varchar(8),
  pga_world_ranking integer,
  profile_image_url text
);

ALTER TABLE public.f1_constructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f1_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.golf_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "f1_constructors_select_public" ON public.f1_constructors;
CREATE POLICY "f1_constructors_select_public"
  ON public.f1_constructors FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "f1_drivers_select_public" ON public.f1_drivers;
CREATE POLICY "f1_drivers_select_public"
  ON public.f1_drivers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "golf_players_select_public" ON public.golf_players;
CREATE POLICY "golf_players_select_public"
  ON public.golf_players FOR SELECT TO anon, authenticated USING (true);

-- Seed enough catalog rows for onboarding comboboxes / F1 grid demos
INSERT INTO public.f1_constructors (id, name, nationality, country_code, team_color_hex) VALUES
  ('mclaren', 'McLaren', 'British', 'gb', '#FF8000'),
  ('ferrari', 'Ferrari', 'Italian', 'it', '#E8002D'),
  ('red_bull', 'Red Bull Racing', 'Austrian', 'at', '#3671C6'),
  ('mercedes', 'Mercedes', 'German', 'de', '#27F4D2'),
  ('williams', 'Williams', 'British', 'gb', '#64C4FF')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  nationality = EXCLUDED.nationality,
  country_code = EXCLUDED.country_code,
  team_color_hex = EXCLUDED.team_color_hex;

INSERT INTO public.f1_drivers (id, name, permanent_number, constructor_id, nationality, country_code) VALUES
  ('norris', 'Lando Norris', 4, 'mclaren', 'British', 'gb'),
  ('piastri', 'Oscar Piastri', 81, 'mclaren', 'Australian', 'au'),
  ('leclerc', 'Charles Leclerc', 16, 'ferrari', 'Monegasque', 'mc'),
  ('hamilton', 'Lewis Hamilton', 44, 'ferrari', 'British', 'gb'),
  ('verstappen', 'Max Verstappen', 1, 'red_bull', 'Dutch', 'nl'),
  ('russell', 'George Russell', 63, 'mercedes', 'British', 'gb'),
  ('albon', 'Alexander Albon', 23, 'williams', 'Thai', 'th'),
  ('sainz', 'Carlos Sainz', 55, 'williams', 'Spanish', 'es'),
  ('antonelli', 'Andrea Kimi Antonelli', 12, 'mercedes', 'Italian', 'it'),
  ('hadjar', 'Isack Hadjar', 6, 'red_bull', 'French', 'fr')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  permanent_number = EXCLUDED.permanent_number,
  constructor_id = EXCLUDED.constructor_id,
  nationality = EXCLUDED.nationality,
  country_code = EXCLUDED.country_code;

INSERT INTO public.golf_players (id, name, nationality, country_code, pga_world_ranking) VALUES
  ('scheffler', 'Scottie Scheffler', 'American', 'us', 1),
  ('mcilroy', 'Rory McIlroy', 'Northern Irish', 'gb-nir', 2),
  ('rahm', 'Jon Rahm', 'Spanish', 'es', 3),
  ('schauffele', 'Xander Schauffele', 'American', 'us', 4),
  ('homa', 'Max Homa', 'American', 'us', 12)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  nationality = EXCLUDED.nationality,
  country_code = EXCLUDED.country_code,
  pga_world_ranking = EXCLUDED.pga_world_ranking;
