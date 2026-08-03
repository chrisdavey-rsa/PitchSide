-- Backfill preferred_nation from profiles.nationality labels
-- so rugby SH auto-subscribe (ZA/NZ/AU/AR) can resolve correctly.

UPDATE public.profiles
SET preferred_nation = CASE lower(trim(nationality))
  WHEN 'south africa' THEN 'ZA'
  WHEN 'new zealand' THEN 'NZ'
  WHEN 'australia' THEN 'AU'
  WHEN 'argentina' THEN 'AR'
  WHEN 'england' THEN 'GB'
  WHEN 'united kingdom' THEN 'GB'
  WHEN 'scotland' THEN 'GB'
  WHEN 'wales' THEN 'GB'
  WHEN 'ireland' THEN 'IE'
  WHEN 'france' THEN 'FR'
  WHEN 'italy' THEN 'IT'
  WHEN 'spain' THEN 'ES'
  WHEN 'germany' THEN 'DE'
  WHEN 'united states' THEN 'US'
  WHEN 'usa' THEN 'US'
  ELSE preferred_nation
END
WHERE preferred_nation IS NULL
  AND nationality IS NOT NULL
  AND trim(nationality) <> '';
