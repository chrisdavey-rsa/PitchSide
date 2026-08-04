import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dbFetchMatches,
  dbFetchActiveCompetitions,
  dbFetchPredictions,
  dbFetchLeagueSubmittedPredictions,
  dbFetchLeagueMemberPredictions,
  dbFetchLeagues,
  dbFetchUserLeagues,
  dbFetchLeagueMembers,
  dbFetchLeaguesMembership,
  dbFetchLiveProvisionalMatrix,
  sumLiveProvisionalMatrix,
  dbFetchGlobalLeaderboard,
  dbFetchTeams,
  MATCH_HORIZON_DAYS,
  type LeaderboardRecord,
} from '../supabase';
import { queryKeys } from '../lib/queryKeys';
import { acquireMatchesRealtime } from '../lib/matchesRealtime';
import { Match, SportType, Competition, ActiveCompetition } from '../types';
import { resolveTeamCatalog, SUPPORTED_TEAMS } from '../data/supportedTeams';
import { BASE_SEASON_YEAR } from '../seasons';

/**
 * Silent Realtime → React Query bridge for live scores.
 * Refcounted: many components can call useMatchesQuery; one channel is shared.
 */
function useMatchesRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => acquireMatchesRealtime(queryClient), [queryClient]);
}

/**
 * Force a matches refetch when the tab/app returns to the foreground.
 * Complements React Query's refetchOnWindowFocus (which skips fresh queries).
 */
function useForegroundMatchesRefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refetchLiveData = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      void queryClient.refetchQueries({ queryKey: queryKeys.matches });
      void queryClient.refetchQueries({ queryKey: ['liveProvisional'] });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetchLiveData();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refetchLiveData);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refetchLiveData);
    };
  }, [queryClient]);
}

export function useMatchesQuery(options?: { enabled?: boolean }) {
  useMatchesRealtimeSync();
  useForegroundMatchesRefetch();

  return useQuery({
    queryKey: queryKeys.matches,
    queryFn: () => dbFetchMatches({ horizonDays: MATCH_HORIZON_DAYS }),
    enabled: options?.enabled !== false,
    // Short stale window so focus/visibility refetches actually hit the network
    // while Realtime still patches live ticks in between.
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

/** Distinct competitions with live/upcoming fixtures in the prediction horizon. */
export function useActiveCompetitionsQuery() {
  return useQuery({
    queryKey: queryKeys.activeCompetitions,
    queryFn: () => dbFetchActiveCompetitions({ horizonDays: MATCH_HORIZON_DAYS }),
  });
}

/** Map DB active competitions into the shared Competition shape for UI chips. */
export function activeCompetitionsToCatalog(
  active: ActiveCompetition[] | undefined,
  sport?: SportType | null,
): Competition[] {
  const list = active ?? [];
  return list
    .filter((entry) => (sport ? entry.sportType === sport : true))
    .map((entry) => ({
      id: entry.competitionId,
      name: entry.competitionName,
      sport: entry.sportType,
    }));
}

export function usePredictionsQuery(userId?: string) {
  return useQuery({
    queryKey: queryKeys.predictions(userId || 'guest'),
    queryFn: () => (userId ? dbFetchPredictions(userId) : Promise.resolve({})),
    enabled: !!userId,
  });
}

/** Submitted predictions for every member of a league (standings engine). */
export function useLeagueStandingsPredictionsQuery(
  leagueId: string | null | undefined,
  memberIds: string[],
) {
  const key = [...memberIds].sort().join(',');
  const seasonStart = new Date(Date.UTC(BASE_SEASON_YEAR, 0, 1)).toISOString();
  return useQuery({
    queryKey: [...queryKeys.leagueStandingsPredictions(leagueId || 'none'), key] as const,
    queryFn: async () => {
      if (!leagueId) return [] as Awaited<ReturnType<typeof dbFetchLeagueMemberPredictions>>;
      try {
        return await dbFetchLeagueMemberPredictions(leagueId, seasonStart);
      } catch {
        // Fallback for older backends / non-members preview: own-row RLS only.
        return dbFetchLeagueSubmittedPredictions(memberIds);
      }
    },
    enabled: !!leagueId && memberIds.length > 0,
  });
}

/** League fixture matrix: member picks for the last 7 days. */
export function useLeagueFixturePredictionsQuery(
  leagueId: string | null | undefined,
  enabled = true,
) {
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return useQuery({
    queryKey: ['leagueFixturePredictions', leagueId || 'none', sinceIso.slice(0, 10)] as const,
    queryFn: () =>
      leagueId
        ? dbFetchLeagueMemberPredictions(leagueId, sinceIso)
        : Promise.resolve([]),
    enabled: !!leagueId && enabled,
    staleTime: 30_000,
  });
}


export function useLeaguesQuery(viewerUserId?: string) {
  return useQuery({
    queryKey: [...queryKeys.leagues, viewerUserId || 'anon'] as const,
    queryFn: () => dbFetchLeagues({ viewerUserId: viewerUserId ?? null }),
  });
}

export function useUserLeaguesQuery(userId?: string) {
  return useQuery({
    queryKey: queryKeys.userLeagues(userId || 'guest'),
    queryFn: () => (userId ? dbFetchUserLeagues(userId) : Promise.resolve([])),
    enabled: !!userId,
  });
}

export function useLeagueMembersQuery(leagueId?: string | null) {
  return useQuery({
    queryKey: queryKeys.leagueMembers(leagueId || 'none'),
    queryFn: () => (leagueId ? dbFetchLeagueMembers(leagueId) : Promise.resolve([])),
    enabled: !!leagueId,
  });
}

export function useLeaguesMembershipQuery(leagueIds: string[]) {
  return useQuery({
    queryKey: queryKeys.leaguesMembership(leagueIds),
    queryFn: () => dbFetchLeaguesMembership(leagueIds),
    enabled: leagueIds.length > 0,
  });
}

export function useLeaderboardQuery(currentUserId?: string, matches: Match[] = []) {
  return useQuery({
    queryKey: queryKeys.leaderboard,
    queryFn: () => dbFetchGlobalLeaderboard(currentUserId, matches),
  });
}

/** Cached teams catalog for profile / signup selectors (falls back to static list). */
export function useTeamsCatalogQuery() {
  return useQuery({
    queryKey: queryKeys.teams,
    queryFn: dbFetchTeams,
    staleTime: 60 * 60 * 1000,
    placeholderData: SUPPORTED_TEAMS,
    select: (rows) => resolveTeamCatalog(rows),
  });
}

/** Live "As It Stands" provisional points totals, keyed by user id. */
export function useLiveProvisionalQuery(matches: Match[] = []) {
  const liveMatchIds = matches
    .filter((m) => m.status === 'live')
    .map((m) => m.id);

  return useQuery({
    queryKey: queryKeys.liveProvisional(liveMatchIds),
    queryFn: () => dbFetchLiveProvisionalMatrix(liveMatchIds),
    enabled: liveMatchIds.length > 0,
    // Realtime patches the matrix in-cache — no polling fan-out.
    select: (matrix) => sumLiveProvisionalMatrix(matrix),
  });
}

export function mapLeaderboardForSport(
  records: LeaderboardRecord[],
  sport: SportType,
  currentUserId?: string,
  provisionalByUser: Record<string, number> = {},
) {
  const isFootball = sport === SportType.FOOTBALL;

  return records
    .filter((item) =>
      isFootball
        ? item.predictionsFootball > 0 || item.settledPredictionsFootball > 0
        : item.predictionsRugby > 0 || item.settledPredictionsRugby > 0,
    )
    .sort((a, b) => {
      const aPts = isFootball ? a.pointsFootball : a.pointsRugby;
      const bPts = isFootball ? b.pointsFootball : b.pointsRugby;
      if (aPts !== bPts) return bPts - aPts;
      const aPerfect = isFootball ? a.perfectHitsFootball : a.perfectHitsRugby;
      const bPerfect = isFootball ? b.perfectHitsFootball : b.perfectHitsRugby;
      if (aPerfect !== bPerfect) return bPerfect - aPerfect;
      const aSettled = isFootball
        ? a.settledPredictionsFootball
        : a.settledPredictionsRugby;
      const bSettled = isFootball
        ? b.settledPredictionsFootball
        : b.settledPredictionsRugby;
      const aStrike = aSettled > 0 ? aPts / aSettled : 0;
      const bStrike = bSettled > 0 ? bPts / bSettled : 0;
      if (aStrike !== bStrike) return bStrike - aStrike;
      return a.nickname.localeCompare(b.nickname);
    })
    .map((item, index) => ({
      ...item,
      displayPoints: isFootball ? item.pointsFootball : item.pointsRugby,
      displayPredictions: isFootball
        ? item.predictionsFootball
        : item.predictionsRugby,
      displaySettledPredictions: isFootball
        ? item.settledPredictionsFootball
        : item.settledPredictionsRugby,
      displayAccuracy: isFootball ? item.accuracyFootball : item.accuracyRugby,
      displayPerfectHits: isFootball
        ? item.perfectHitsFootball
        : item.perfectHitsRugby,
      displayGhostPoints: isFootball ? item.ghostPointsFootball : item.ghostPointsRugby,
      displayDropsUsed: isFootball ? item.dropsUsedFootball : item.dropsUsedRugby,
      displayDropsAllowed: isFootball
        ? item.dropsAllowedFootball
        : item.dropsAllowedRugby,
      /** Amber "As It Stands" live points — distinct from locked displayPoints. */
      displayProvisionalPoints: provisionalByUser[item.playerId] || 0,
      rank: index + 1,
      isCurrentUser: item.isCurrentUser || item.playerId === currentUserId,
    }));
}

export function mergeMatches(dbMatches: Match[], localMatches: Match[]) {
  const seen = new Set<string>();
  const combined: Match[] = [];

  dbMatches.forEach((match) => {
    combined.push(match);
    seen.add(match.id);
  });

  localMatches.forEach((match) => {
    if (!seen.has(match.id)) {
      combined.push(match);
      seen.add(match.id);
    }
  });

  return combined;
}

