-- Upsert the confirmed 2026 F1 grid: 11 constructors + 22 full-time drivers.
-- Also removes outdated entries (Doohan, Tsunoda, Drugovich).
-- Safe to re-run.

INSERT INTO public.f1_constructors (id, name, nationality, country_code, team_color_hex) VALUES
  ('red_bull', 'Red Bull Racing', 'Austrian', 'at', '#3671C6'),
  ('mclaren', 'McLaren', 'British', 'gb', '#FF8000'),
  ('ferrari', 'Ferrari', 'Italian', 'it', '#E8002D'),
  ('mercedes', 'Mercedes', 'German', 'de', '#27F4D2'),
  ('aston_martin', 'Aston Martin', 'British', 'gb', '#229971'),
  ('racing_bulls', 'Racing Bulls', 'Italian', 'it', '#6692FF'),
  ('haas', 'Haas', 'American', 'us', '#B6BABD'),
  ('alpine', 'Alpine', 'French', 'fr', '#0093CC'),
  ('williams', 'Williams', 'British', 'gb', '#64C4FF'),
  ('audi', 'Audi', 'German', 'de', '#52E252'),
  ('cadillac', 'Cadillac', 'American', 'us', '#FFFFFF')
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
  ('hadjar', 'Isack Hadjar', 6, 'red_bull', 'French', 'fr'),
  ('russell', 'George Russell', 63, 'mercedes', 'British', 'gb'),
  ('antonelli', 'Kimi Antonelli', 12, 'mercedes', 'Italian', 'it'),
  ('albon', 'Alexander Albon', 23, 'williams', 'Thai', 'th'),
  ('sainz', 'Carlos Sainz', 55, 'williams', 'Spanish', 'es'),
  ('alonso', 'Fernando Alonso', 14, 'aston_martin', 'Spanish', 'es'),
  ('stroll', 'Lance Stroll', 18, 'aston_martin', 'Canadian', 'ca'),
  ('gasly', 'Pierre Gasly', 10, 'alpine', 'French', 'fr'),
  ('colapinto', 'Franco Colapinto', 43, 'alpine', 'Argentine', 'ar'),
  ('ocon', 'Esteban Ocon', 31, 'haas', 'French', 'fr'),
  ('bearman', 'Oliver Bearman', 87, 'haas', 'British', 'gb'),
  ('lawson', 'Liam Lawson', 30, 'racing_bulls', 'New Zealander', 'nz'),
  ('lindblad', 'Arvid Lindblad', 41, 'racing_bulls', 'British', 'gb'),
  ('hulkenberg', 'Nico Hulkenberg', 27, 'audi', 'German', 'de'),
  ('bortoleto', 'Gabriel Bortoleto', 5, 'audi', 'Brazilian', 'br'),
  ('perez', 'Sergio Perez', 11, 'cadillac', 'Mexican', 'mx'),
  ('bottas', 'Valtteri Bottas', 77, 'cadillac', 'Finnish', 'fi')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  permanent_number = EXCLUDED.permanent_number,
  constructor_id = EXCLUDED.constructor_id,
  nationality = EXCLUDED.nationality,
  country_code = EXCLUDED.country_code;

DELETE FROM public.f1_drivers
WHERE id IN ('doohan', 'tsunoda', 'drugovich')
   OR lower(trim(name)) IN ('jack doohan', 'yuki tsunoda', 'felipe drugovich');

-- Drop legacy constructor aliases with no remaining drivers.
DELETE FROM public.f1_constructors
WHERE id IN ('rb', 'sauber')
  AND NOT EXISTS (
    SELECT 1 FROM public.f1_drivers d WHERE d.constructor_id = f1_constructors.id
  );
