/**
 * Refcounted Supabase Realtime subscription for public.matches.
 *
 * Design notes (cost / scale / security):
 * - One shared channel for the whole SPA (not one per hook instance).
 * - Patches React Query cache in-place — no invalidate/refetch on live ticks.
 * - Realtime respects matches SELECT RLS (public read); clients never write.
 * - Only re-renders when live-relevant fields actually change.
 */

import type { QueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, mapMatchRow, type LiveProvisionalMatrix } from '../supabase';
import { queryKeys } from './queryKeys';
import type { Match } from '../types';

const CHANNEL_NAME = 'pitchside-matches-live';

type LivePatch = Pick<
  Match,
  | 'status'
  | 'provisionalHomeScore'
  | 'provisionalAwayScore'
  | 'matchMinute'
  | 'homeScore'
  | 'awayScore'
>;

let channel: RealtimeChannel | null = null;
let subscriberCount = 0;
let boundClient: QueryClient | null = null;

function toLivePatch(row: Record<string, unknown>): LivePatch {
  const mapped = mapMatchRow(row);
  return {
    status: mapped.status,
    provisionalHomeScore: mapped.provisionalHomeScore,
    provisionalAwayScore: mapped.provisionalAwayScore,
    matchMinute: mapped.matchMinute,
    homeScore: mapped.homeScore,
    awayScore: mapped.awayScore,
  };
}

function liveFieldsEqual(a: Match, patch: LivePatch): boolean {
  return (
    a.status === patch.status &&
    a.provisionalHomeScore === patch.provisionalHomeScore &&
    a.provisionalAwayScore === patch.provisionalAwayScore &&
    a.matchMinute === patch.matchMinute &&
    a.homeScore === patch.homeScore &&
    a.awayScore === patch.awayScore
  );
}

function applyCompletedCleanup(
  queryClient: QueryClient,
  matchId: string,
) {
  // Settle is rare — refresh derived views in the background (no matches refetch).
  void queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard });
  void queryClient.invalidateQueries({ queryKey: queryKeys.activeCompetitions });

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

/** Apply a matches UPDATE payload to the React Query cache (silent). */
export function patchMatchesQueryCache(
  queryClient: QueryClient,
  row: Record<string, unknown> | null | undefined,
) {
  if (!row?.id || typeof row.id !== 'string') return;

  const patch = toLivePatch(row);
  let becameCompleted = false;

  queryClient.setQueryData<Match[]>(queryKeys.matches, (prev) => {
    if (!prev) return prev;

    const idx = prev.findIndex((m) => m.id === row.id);
    if (idx === -1) {
      // Avoid refetch storms for out-of-horizon rows. Only admit live fixtures
      // that just entered play so the predictor can show them without reload.
      if (patch.status !== 'live') return prev;
      const mapped = mapMatchRow(row);
      if (mapped.isVisible === false) return prev;
      return [...prev, mapped].sort((a, b) =>
        a.matchDate.localeCompare(b.matchDate),
      );
    }

    const current = prev[idx];
    if (liveFieldsEqual(current, patch)) return prev;

    becameCompleted =
      patch.status === 'completed' && current.status !== 'completed';

    const next = [...prev];
    next[idx] = {
      ...current,
      ...patch,
      // Kill-switch: clear live-only fields when settled.
      ...(patch.status === 'completed'
        ? {
            provisionalHomeScore: undefined,
            provisionalAwayScore: undefined,
            matchMinute: undefined,
          }
        : {}),
    };
    return next;
  });

  if (becameCompleted) {
    applyCompletedCleanup(queryClient, row.id);
  }
}

function ensureChannel(queryClient: QueryClient) {
  if (channel) {
    boundClient = queryClient;
    return;
  }
  if (!supabase) return;

  boundClient = queryClient;
  channel = supabase
    .channel(CHANNEL_NAME)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches' },
      (payload) => {
        const client = boundClient;
        if (!client) return;
        patchMatchesQueryCache(
          client,
          payload.new as Record<string, unknown> | null,
        );
      },
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[matches-realtime] channel issue:', status, err?.message);
      }
    });
}

function releaseChannel() {
  if (!supabase || !channel) return;
  void supabase.removeChannel(channel);
  channel = null;
  boundClient = null;
}

/**
 * Acquire the shared matches realtime channel. Returns a release function for
 * the hook cleanup path (`removeChannel` when the last subscriber unmounts).
 */
export function acquireMatchesRealtime(queryClient: QueryClient): () => void {
  if (!supabase) return () => {};

  subscriberCount += 1;
  ensureChannel(queryClient);

  return () => {
    subscriberCount = Math.max(0, subscriberCount - 1);
    if (subscriberCount === 0) {
      releaseChannel();
    }
  };
}
