-- Golden Ticket inventory + marquee fixture flag + award helper.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS golden_tickets integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_golden_tickets_nonnegative;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_golden_tickets_nonnegative CHECK (golden_tickets >= 0);

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS is_golden_ticket boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.golden_tickets IS
  'Count of Golden Tickets held (God Mode + Summit entry). Not a consumable Chip.';
COMMENT ON COLUMN public.matches.is_golden_ticket IS
  'Marquee fixtures that award a Golden Ticket on a true Perfect Prediction.';

-- Community Shield / known Golden Ticket fixtures.
UPDATE public.matches
SET is_golden_ticket = true
WHERE competition_id = 'f-shield'
   OR id = 'f-communityshield'
   OR lower(coalesce(match_tag, '')) LIKE '%golden%ticket%';

CREATE OR REPLACE FUNCTION public.increment_golden_tickets(p_user_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' THEN
    RAISE EXCEPTION 'user id required';
  END IF;

  UPDATE public.profiles
  SET golden_tickets = COALESCE(golden_tickets, 0) + 1
  WHERE id = p_user_id
  RETURNING golden_tickets INTO v_count;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_golden_tickets(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_golden_tickets(text) TO service_role;
