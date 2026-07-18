import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  supabase,
  mapMatchRow,
  type PredictionEntry,
  type LiveProvisionalMatrix,
} from '../supabase';
import { queryKeys } from '../lib/queryKeys';
import type { Match } from '../types';

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

function removeMatchFromLiveProvisional(
  queryClient: ReturnType<typeof useQueryClient>,
  matchId: string,
) {
  queryClient.setQueriesData<LiveProvisionalMatrix>(
    { queryKey: ['liveProvisional'] },
    (prev) => {
      if (!prev) return prev;
      let changed = false;
      const next: LiveProvisionalMatrix = {};
      for (const [uid, byMatch] of Object.entries(prev)) {
        if (!(matchId in byMatch)) {
          next[uid] = byMatch;
          continue;
        }
        changed = true;
        const rest = { ...byMatch };
        delete rest[matchId];
        if (Object.keys(rest).length > 0) next[uid] = rest;
      }
      return changed ? next : prev;
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

    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches' },
      (payload) => {
        const row = payload.new as Record<string, unknown> | null;
        if (!row?.id) {
          invalidate('matches');
          return;
        }

        const mapped = mapMatchRow(row);
        queryClient.setQueryData<Match[]>(queryKeys.matches, (prev) => {
          if (!prev) return prev;
          const idx = prev.findIndex((m) => m.id === mapped.id);
          if (idx === -1) {
            invalidate('matches');
            return prev;
          }
          const next = [...prev];
          next[idx] = { ...next[idx], ...mapped };
          return next;
        });

        if (mapped.status === 'completed') {
          queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard });
          removeMatchFromLiveProvisional(queryClient, mapped.id);
        } else if (mapped.status !== 'live') {
          removeMatchFromLiveProvisional(queryClient, mapped.id);
        }
      },
    );

    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'predictions' },
      (payload) => {
        const row = payload.new as Record<string, any> | null;
        if (!row?.match_id) {
          invalidate('predictions');
          return;
        }

        if (row.user_id === userId) {
          queryClient.setQueryData<Record<string, PredictionEntry>>(
            queryKeys.predictions(userId),
            (prev) => {
              if (!prev) return prev;
              const existing = prev[row.match_id] || {
                home: 0,
                away: 0,
                submitted: false,
              };
              return {
                ...prev,
                [row.match_id]: {
                  home: row.predicted_home_score ?? existing.home,
                  away: row.predicted_away_score ?? existing.away,
                  submitted: row.submitted ?? existing.submitted,
                  lockedAt: row.submitted
                    ? row.created_at ?? existing.lockedAt
                    : existing.lockedAt,
                  provisionalPoints: row.provisional_points ?? 0,
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

    (['matches', 'predictions'] as const).forEach((table) => {
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
