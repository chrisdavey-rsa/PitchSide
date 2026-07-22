import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dbFetchMatches,
  dbFetchActiveCompetitions,
  dbFetchPredictions,
  dbFetchLeagueSubmittedPredictions,
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

/**
 * Silent Realtime → React Query bridge for live scores.
 * Refcounted: many components can call useMatchesQuery; one channel is shared.
 */
function useMatchesRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => acquireMatchesRealtime(queryClient), [queryClient]);
}

export function useMatchesQuery() {
  useMatchesRealtimeSync();

  return useQuery({
    queryKey: queryKeys.matches,
    queryFn: () => dbFetchMatches({ horizonDays: MATCH_HORIZON_DAYS }),
    // Live fields arrive via Realtime patches — avoid focus/reconnect refetches
    // that would look like loading flashes during a match.
    staleTime: 5 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
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
  return useQuery({
    queryKey: [...queryKeys.leagueStandingsPredictions(leagueId || 'none'), key] as const,
    queryFn: () => dbFetchLeagueSubmittedPredictions(memberIds),
    enabled: !!leagueId && memberIds.length > 0,
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
    .filter((item) => (isFootball ? item.predictionsFootball > 0 : item.predictionsRugby > 0))
    .sort((a, b) =>
      isFootball ? b.pointsFootball - a.pointsFootball : b.pointsRugby - a.pointsRugby,
    )
    .map((item, index) => ({
      ...item,
      displayPoints: isFootball ? item.pointsFootball : item.pointsRugby,
      displayPredictions: isFootball ? item.predictionsFootball : item.predictionsRugby,
      displayAccuracy: isFootball ? item.accuracyFootball : item.accuracyRugby,
      displayGhostPoints: isFootball ? item.ghostPointsFootball : item.ghostPointsRugby,
      displayDropsUsed: isFootball ? item.dropsUsedFootball : item.dropsUsedRugby,
      displayDropsAllowed: isFootball ? item.dropsAllowedFootball : item.dropsAllowedRugby,
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

