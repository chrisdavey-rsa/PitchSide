-- Fix Racing Bulls display name (was abbreviated "RB" on constructor id `rb`).
-- Safe to re-run.

UPDATE public.f1_constructors
SET name = 'Racing Bulls'
WHERE id IN ('rb', 'racing_bulls')
   OR lower(trim(name)) IN ('rb', 'r.b.', 'rbr');

-- Optional: point any leftover `rb` drivers at the canonical id.
UPDATE public.f1_drivers
SET constructor_id = 'racing_bulls'
WHERE constructor_id = 'rb';
