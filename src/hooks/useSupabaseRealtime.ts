import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, mapMatchRow, type PredictionEntry } from '../supabase';
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

/**
 * Dashboard realtime sync.
 *
 * For live "As It Stands" updates we PATCH the React Query cache directly on
 * matches/predictions UPDATE events so provisional scores and points appear
 * without a full refetch. Other tables still invalidate their query keys.
 */
export function useSupabaseRealtime(userId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel('pitchside-dashboard-sync');

    const invalidate = (table: RealtimeTable) => {
      const keys = TABLE_QUERY_MAP[table];
      keys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      if (table === 'predictions' && userId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.predictions(userId) });
      }
      if (table === 'league_members') {
        if (userId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.userLeagues(userId) });
        }
        queryClient.invalidateQueries({ queryKey: ['leagueMembers'] });
        queryClient.invalidateQueries({ queryKey: ['leaguesMembership'] });
      }
      if (table === 'matches' || table === 'predictions') {
        // Refresh aggregated live provisional totals for the leaderboard badges.
        queryClient.invalidateQueries({ queryKey: ['liveProvisional'] });
      }
    };

    // ---- MATCHES: seamless merge of live scoring columns --------------------
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
            // New row we haven't seen — fall back to a full refetch.
            invalidate('matches');
            return prev;
          }
          const next = [...prev];
          next[idx] = { ...next[idx], ...mapped };
          return next;
        });

        // Leaderboard RPC may need a soft refresh when a match completes.
        if (mapped.status === 'completed') {
          queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard });
        }
        queryClient.invalidateQueries({ queryKey: ['liveProvisional'] });
      },
    );

    // ---- PREDICTIONS: merge provisional_points into the user's cache --------
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'predictions' },
      (payload) => {
        const row = payload.new as Record<string, any> | null;
        if (!row?.match_id) {
          invalidate('predictions');
          return;
        }

        if (userId && row.user_id === userId) {
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

        // Keep the amber leaderboard badges in sync for every player.
        queryClient.invalidateQueries({ queryKey: ['liveProvisional'] });
      },
    );

    // ---- Remaining tables: invalidate as before -----------------------------
    (['profiles', 'leagues', 'league_members'] as RealtimeTable[]).forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => invalidate(table),
      );
    });

    // Also listen for INSERT/DELETE on matches & predictions (full invalidate).
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
  }, [queryClient, userId]);
}
