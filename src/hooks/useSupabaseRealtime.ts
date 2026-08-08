import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  supabase,
  type PredictionEntry,
  type LiveProvisionalMatrix,
} from '../supabase';
import { queryKeys } from '../lib/queryKeys';

type RealtimeTable =
  | 'profiles'
  | 'predictions'
  | 'matches'
  | 'leagues'
  | 'league_members';

type QueryKeyLike = readonly unknown[];

const TABLE_QUERY_MAP: Record<RealtimeTable, readonly QueryKeyLike[]> = {
  profiles: [queryKeys.leaderboard, queryKeys.players],
  predictions: [queryKeys.leaderboard],
  // matches live scores are patched by src/lib/matchesRealtime.ts (via useMatchesQuery)
  matches: [queryKeys.matches, queryKeys.activeCompetitions, queryKeys.leaderboard],
  leagues: [queryKeys.leagues],
  league_members: [queryKeys.leagues],
};

function patchLiveProvisionalCell(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  matchId: string,
  points: number,
) {
  queryClient.setQueriesData<LiveProvisionalMatrix>(
    { queryKey: ['liveProvisional'] },
    (prev) => {
      const next: LiveProvisionalMatrix = prev ? { ...prev } : {};
      const userRow = { ...(next[userId] || {}) };
      if (points > 0) {
        userRow[matchId] = points;
      } else {
        delete userRow[matchId];
      }
      if (Object.keys(userRow).length === 0) {
        delete next[userId];
      } else {
        next[userId] = userRow;
      }
      return next;
    },
  );
}

export type UseSupabaseRealtimeOptions = {
  /** Fired when profiles change — used by App to refresh registeredUsers without a 2nd channel. */
  onProfilesChange?: () => void;
};

/**
 * Single realtime channel per logged-in session (`pitchside-dashboard-sync`).
 * Live provisional totals are patched in-cache; no mass invalidate / poll.
 */
export function useSupabaseRealtime(
  userId?: string,
  options?: UseSupabaseRealtimeOptions,
) {
  const queryClient = useQueryClient();
  const onProfilesChange = options?.onProfilesChange;

  useEffect(() => {
    if (!supabase || !userId) return;

    const channel = supabase.channel(`pitchside-sync:${userId}`);

    const invalidate = (table: RealtimeTable) => {
      const keys = TABLE_QUERY_MAP[table];
      keys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      if (table === 'predictions') {
        queryClient.invalidateQueries({ queryKey: queryKeys.predictions(userId) });
      }
      if (table === 'league_members') {
        queryClient.invalidateQueries({ queryKey: queryKeys.userLeagues(userId) });
        queryClient.invalidateQueries({ queryKey: ['leagueMembers'] });
        queryClient.invalidateQueries({ queryKey: ['leaguesMembership'] });
      }
      if (table === 'profiles') {
        onProfilesChange?.();
      }
    };

    // matches UPDATE is owned by useMatchesQuery → acquireMatchesRealtime
    // (silent cache patch, no invalidate on live ticks).

    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'predictions' },
      (payload) => {
        const row = payload.new as Record<string, unknown> | null;
        if (!row?.match_id) {
          invalidate('predictions');
          return;
        }

        if (row.user_id === userId) {
          const matchId = String(row.match_id);
          queryClient.setQueryData<Record<string, PredictionEntry>>(
            queryKeys.predictions(userId),
            (prev) => {
              if (!prev) return prev;
              const existing = prev[matchId] || {
                home: 0,
                away: 0,
                submitted: false,
              };
              const predictedHome =
                typeof row.predicted_home_score === "number"
                  ? row.predicted_home_score
                  : existing.home;
              const predictedAway =
                typeof row.predicted_away_score === "number"
                  ? row.predicted_away_score
                  : existing.away;
              const submitted =
                typeof row.submitted === "boolean"
                  ? row.submitted
                  : existing.submitted;
              return {
                ...prev,
                [matchId]: {
                  home: predictedHome,
                  away: predictedAway,
                  submitted,
                  lockedAt: submitted
                    ? (typeof row.created_at === "string"
                        ? row.created_at
                        : existing.lockedAt)
                    : existing.lockedAt,
                  provisionalPoints:
                    row.provisional_points != null
                      ? Number(row.provisional_points)
                      : existing.provisionalPoints ?? 0,
                  pointsWon:
                    row.points_won != null
                      ? Number(row.points_won)
                      : existing.pointsWon ?? null,
                  appliedChipId:
                    (typeof row.applied_chip_id === "string"
                      ? row.applied_chip_id
                      : row.applied_chip_id === null
                        ? null
                        : undefined) ??
                    existing.appliedChipId ??
                    null,
                },
              };
            },
          );
        }

        if (row.user_id) {
          patchLiveProvisionalCell(
            queryClient,
            String(row.user_id),
            String(row.match_id),
            Number(row.provisional_points) || 0,
          );
        }
      },
    );

    (['profiles', 'leagues', 'league_members'] as RealtimeTable[]).forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => invalidate(table),
      );
    });

    // Schedule inserts/deletes for matches are rare — one invalidate is fine.
    // Live score ticks must NOT land here (they use the dedicated matches channel).
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'matches' },
      () => invalidate('matches'),
    );
    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'matches' },
      () => invalidate('matches'),
    );

    (['predictions'] as const).forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table },
        () => invalidate(table),
      );
      channel.on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table },
        () => invalidate(table),
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId, onProfilesChange]);
}
