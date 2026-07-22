/**
 * Concurrent cold-start preload: auth/profile + fixtures + (when logged in)
 * leagues & predictions. Results are seeded into the React Query cache so the
 * Dashboard mounts with data already available.
 */

import type { QueryClient } from '@tanstack/react-query';
import {
  dbFetchMatches,
  dbFetchPredictions,
  dbFetchUserLeagues,
  MATCH_HORIZON_DAYS,
  supabase,
  type PredictionEntry,
} from '../supabase';
import { profileFromSession } from '../components/auth/authSession';
import { queryKeys } from './queryKeys';
import type { ActiveCompetition, League, Match, UserProfile } from '../types';

export type PlatformInitResult = {
  profile: UserProfile | null;
  matches: Match[];
  userLeagues: League[];
  predictions: Record<string, PredictionEntry>;
};

/** Derive filter chips from the already-fetched horizon fixtures (no extra API call). */
function activeCompetitionsFromMatches(matches: Match[]): ActiveCompetition[] {
  const byKey = new Map<string, ActiveCompetition>();
  for (const match of matches) {
    if (!match.competitionId || match.status === 'completed') continue;
    const key = `${match.sport}::${match.competitionId}`;
    if (byKey.has(key)) continue;
    byKey.set(key, {
      competitionId: match.competitionId,
      competitionName: match.competitionName?.trim() || match.competitionId,
      sportType: match.sport,
    });
  }
  return Array.from(byKey.values()).sort((a, b) =>
    a.competitionName.localeCompare(b.competitionName),
  );
}

function readLocalProfile(): UserProfile | null {
  try {
    const saved = localStorage.getItem('pitchside_logged_in');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (parsed?.id && parsed?.email) return parsed as UserProfile;
  } catch {
    /* ignore */
  }
  localStorage.removeItem('pitchside_logged_in');
  return null;
}

/** Auth check: Supabase session → profiles row, or local sandbox fallback. */
async function resolveAuthProfile(): Promise<UserProfile | null> {
  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      try {
        return await profileFromSession(session.user);
      } catch (err) {
        console.warn('initializePlatform: profile load failed', err);
        return null;
      }
    }
    localStorage.removeItem('pitchside_logged_in');
    return null;
  }

  return readLocalProfile();
}

/** Horizon fixtures for the prediction window. */
async function resolveCoreMatches(): Promise<Match[]> {
  try {
    return await dbFetchMatches({ horizonDays: MATCH_HORIZON_DAYS });
  } catch (err) {
    console.warn('initializePlatform: matches fetch failed', err);
    return [];
  }
}

/**
 * Active leagues + recent predictions for the signed-in user.
 * Re-reads the session so this can run concurrently with the auth check.
 */
async function resolveUserData(): Promise<{
  userId: string | null;
  userLeagues: League[];
  predictions: Record<string, PredictionEntry>;
}> {
  let userId: string | null = null;

  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    userId = session?.user?.id ?? null;
  } else {
    userId = readLocalProfile()?.id ?? null;
  }

  if (!userId) {
    return { userId: null, userLeagues: [], predictions: {} };
  }

  const [userLeagues, predictions] = await Promise.all([
    dbFetchUserLeagues(userId).catch((err) => {
      console.warn('initializePlatform: user leagues fetch failed', err);
      return [] as League[];
    }),
    dbFetchPredictions(userId).catch((err) => {
      console.warn('initializePlatform: predictions fetch failed', err);
      return {} as Record<string, PredictionEntry>;
    }),
  ]);

  return { userId, userLeagues, predictions };
}

/**
 * Run auth, core fixtures, and user-scoped data concurrently, then seed the
 * React Query cache so Dashboard hooks resolve instantly.
 */
export async function initializePlatform(
  queryClient: QueryClient,
): Promise<PlatformInitResult> {
  const [profile, matches, userData] = await Promise.all([
    resolveAuthProfile(),
    resolveCoreMatches(),
    resolveUserData(),
  ]);

  queryClient.setQueryData(queryKeys.matches, matches);
  queryClient.setQueryData(
    queryKeys.activeCompetitions,
    activeCompetitionsFromMatches(matches),
  );

  const userId = profile?.id ?? userData.userId;
  if (userId) {
    queryClient.setQueryData(queryKeys.userLeagues(userId), userData.userLeagues);
    queryClient.setQueryData(queryKeys.predictions(userId), userData.predictions);
  }

  return {
    profile,
    matches,
    userLeagues: userData.userLeagues,
    predictions: userData.predictions,
  };
}
