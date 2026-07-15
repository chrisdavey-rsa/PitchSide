import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
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
  matches: [queryKeys.matches, queryKeys.leaderboard],
  leagues: [queryKeys.leagues],
  league_members: [queryKeys.leagues],
};

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
      if (table === 'league_members' && userId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.userLeagues(userId) });
      }
    };

    (Object.keys(TABLE_QUERY_MAP) as RealtimeTable[]).forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => invalidate(table),
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}
