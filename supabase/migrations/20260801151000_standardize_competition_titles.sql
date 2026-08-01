-- Canonical football competition display titles.
-- English Premier League / Scottish Premiership / EFL Championship (England).

UPDATE public.competitions
SET name = 'English Premier League'
WHERE id = 'f-epl';

UPDATE public.competitions
SET name = 'Scottish Premiership'
WHERE id = 'f-spfl';

UPDATE public.competitions
SET name = 'EFL Championship'
WHERE id = 'f-championship';

UPDATE public.matches
SET competition_name = 'English Premier League'
WHERE competition_id = 'f-epl';

UPDATE public.matches
SET competition_name = 'Scottish Premiership'
WHERE competition_id = 'f-spfl';

UPDATE public.matches
SET competition_name = 'EFL Championship'
WHERE competition_id = 'f-championship';
