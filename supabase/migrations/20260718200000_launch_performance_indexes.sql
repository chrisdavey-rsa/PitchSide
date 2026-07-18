-- Launch performance indexes for World Cup–scale read traffic.
-- Safe to re-run: IF NOT EXISTS on every index.
--
-- Paste into the Supabase SQL Editor if you prefer not to use the CLI migrate path.

-- predictions: dashboard loads, live provisional, leaderboard RPC joins
CREATE INDEX IF NOT EXISTS idx_predictions_user_id
  ON public.predictions (user_id);

CREATE INDEX IF NOT EXISTS idx_predictions_match_id
  ON public.predictions (match_id);

CREATE INDEX IF NOT EXISTS idx_predictions_user_id_submitted
  ON public.predictions (user_id, submitted)
  WHERE submitted = true;

CREATE INDEX IF NOT EXISTS idx_predictions_match_provisional
  ON public.predictions (match_id)
  WHERE provisional_points > 0;

-- matches: horizon windows, status filters, competition chips
CREATE INDEX IF NOT EXISTS idx_matches_kickoff_time
  ON public.matches (kickoff_time);

CREATE INDEX IF NOT EXISTS idx_matches_status
  ON public.matches (status);

CREATE INDEX IF NOT EXISTS idx_matches_competition_id
  ON public.matches (competition_id);

CREATE INDEX IF NOT EXISTS idx_matches_status_kickoff
  ON public.matches (status, kickoff_time);
