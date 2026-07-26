-- Align f1_drivers with the confirmed 2026 grid (22 drivers / 11 teams).
-- Remove outdated full-time entries:
--   - Jack Doohan (Alpine seat taken by Franco Colapinto)
--   - Yuki Tsunoda (reserve/test role; Racing Bulls = Lawson + Lindblad)

DELETE FROM public.f1_drivers
WHERE id IN ('doohan', 'tsunoda')
   OR lower(trim(name)) IN ('jack doohan', 'yuki tsunoda');
