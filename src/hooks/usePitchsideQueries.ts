import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  dbFetchMatches,
  dbFetchPredictions,
  dbFetchLeagues,
  dbFetchUserLeagues,
  dbFetchLeagueMembers,
  dbFetchLeaguesMembership,
  dbFetchGlobalLeaderboard,
  dbSavePrediction,
  type LeaderboardRecord,
} from '../supabase';
import { queryKeys } from '../lib/queryKeys';
import { Match, SportType } from '../types';

export function useMatchesQuery() {
  return useQuery({
    queryKey: queryKeys.matches,
    queryFn: dbFetchMatches,
  });
}

export function usePredictionsQuery(userId?: string) {
  return useQuery({
    queryKey: queryKeys.predictions(userId || 'guest'),
    queryFn: () => (userId ? dbFetchPredictions(userId) : Promise.resolve({})),
    enabled: !!userId,
  });
}

export function useLeaguesQuery() {
  return useQuery({
    queryKey: queryKeys.leagues,
    queryFn: dbFetchLeagues,
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

export function useSavePredictionMutation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      matchId,
      sport,
      competitionId,
      home,
      away,
      submitted,
    }: {
      matchId: string;
      sport: SportType;
      competitionId: string;
      home: number;
      away: number;
      submitted: boolean;
    }) => {
      await dbSavePrediction(userId, matchId, sport, competitionId, home, away, submitted);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.predictions(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard });
    },
  });
}

export type { LeaderboardRecord };

export function mapLeaderboardForSport(
  records: LeaderboardRecord[],
  sport: SportType,
  currentUserId?: string,
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
