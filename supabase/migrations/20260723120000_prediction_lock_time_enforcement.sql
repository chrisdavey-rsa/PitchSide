-- =============================================================================
-- Server-side prediction lock-time enforcement
-- Rejects INSERT/UPDATE on public.predictions when now() >= match kickoff
-- (or the fixture is already live / completed).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_prediction_lock_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_kickoff timestamptz;
  v_status text;
BEGIN
  SELECT m.kickoff_time, m.status
  INTO v_kickoff, v_status
  FROM public.matches m
  WHERE m.id = NEW.match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event locked. Predictions can no longer be submitted.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Lock time = kickoff. Also treat live/completed as locked.
  IF v_status IN ('live', 'completed')
     OR v_kickoff IS NULL
     OR timezone('utc', now()) >= v_kickoff THEN
    RAISE EXCEPTION 'Event locked. Predictions can no longer be submitted.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_predictions_enforce_lock_time ON public.predictions;

CREATE TRIGGER trg_predictions_enforce_lock_time
  BEFORE INSERT OR UPDATE ON public.predictions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_prediction_lock_time();

COMMENT ON FUNCTION public.enforce_prediction_lock_time() IS
  'Rejects prediction writes after match kickoff (lock time). Message: Event locked. Predictions can no longer be submitted.';

-- Trigger helpers should not be callable via PostgREST.
REVOKE ALL ON FUNCTION public.enforce_prediction_lock_time() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_prediction_lock_time() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_prediction_lock_time() FROM authenticated;
