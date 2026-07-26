-- Remove legacy constructor rows with no 2026 drivers (rb alias, pre-Audi Sauber).

DELETE FROM public.f1_constructors
WHERE id IN ('rb', 'sauber')
  AND NOT EXISTS (
    SELECT 1 FROM public.f1_drivers d WHERE d.constructor_id = f1_constructors.id
  );
