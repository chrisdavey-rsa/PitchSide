/**
 * Mulligan power-up UI for Golf Majors.
 * Shows "Play Mulligan" when a roster golfer misses the Friday cut and the
 * player still has golf_mulligans_available > 0.
 */

import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import CountryFlag from '../../../../components/CountryFlag';
import type { GolfPlayer } from '../../types';
import { useGolfMulliganWallet, useGolfPlayersQuery } from '../../hooks/useEmergingSports';
import EmergingSearchCombobox from '../EmergingSearchCombobox';

export type GolfRosterEntry = {
  playerId: string;
  /** true when the golfer missed the Friday cut */
  missedCut: boolean;
};

type Props = {
  userId: string;
  /** Current 5-player roster (tier picks). */
  roster: GolfRosterEntry[];
  /** Tournament must be a Major with cut complete / pre-Saturday window. */
  mulliganWindowOpen: boolean;
  onSwap?: (cutPlayerId: string, replacementId: string) => Promise<void> | void;
};

export default function GolfMulliganPanel({
  userId,
  roster,
  mulliganWindowOpen,
  onSwap,
}: Props) {
  const { available, pending, consumeMulligan } = useGolfMulliganWallet(userId);
  const { data: golfers = [] } = useGolfPlayersQuery();
  const [activeCutId, setActiveCutId] = useState<string | null>(null);
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const byId = useMemo(
    () => new Map(golfers.map((g) => [g.id, g] as const)),
    [golfers],
  );

  const madeCutOptions = useMemo(() => {
    const rosterIds = new Set(roster.map((r) => r.playerId));
    return golfers
      .filter((g) => !rosterIds.has(g.id))
      .map((g) => ({
        id: g.id,
        label: g.name,
        countryCode: g.countryCode,
      }));
  }, [golfers, roster]);

  const cutEntries = roster.filter((r) => r.missedCut);

  if (!mulliganWindowOpen || cutEntries.length === 0) return null;

  const apply = async () => {
    if (!activeCutId || !replacementId || available <= 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const ok = await consumeMulligan();
      if (!ok) {
        setMessage('No mulligans remaining.');
        return;
      }
      await onSwap?.(activeCutId, replacementId);
      setMessage('Mulligan played — roster updated.');
      setActiveCutId(null);
      setReplacementId(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Mulligan failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-amber-200">Mulligan window</h3>
        <span className="text-[10px] font-mono text-amber-300/80">
          {available} available
        </span>
      </div>

      <ul className="space-y-2">
        {cutEntries.map((entry) => {
          const player: GolfPlayer | undefined = byId.get(entry.playerId);
          return (
            <li
              key={entry.playerId}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2"
            >
              <CountryFlag code={player?.countryCode} size={16} alt="" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-200 truncate">
                  {player?.name ?? entry.playerId}
                </div>
                <div className="text-[10px] text-rose-300/80 font-mono">Missed cut</div>
              </div>
              <button
                type="button"
                disabled={available <= 0 || pending}
                onClick={() => setActiveCutId(entry.playerId)}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold text-amber-200 disabled:opacity-40"
              >
                <RefreshCw className="h-3 w-3" />
                Play Mulligan
              </button>
            </li>
          );
        })}
      </ul>

      {activeCutId && (
        <div className="space-y-2 border-t border-slate-800 pt-3">
          <p className="text-[11px] text-slate-400">
            Replace{' '}
            <span className="text-slate-200 font-semibold">
              {byId.get(activeCutId)?.name ?? activeCutId}
            </span>{' '}
            with a golfer who made the cut (before Saturday tee-off).
          </p>
          <EmergingSearchCombobox
            label="Replacement golfer"
            placeholder="Search active field…"
            options={madeCutOptions}
            value={replacementId}
            onChange={setReplacementId}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!replacementId || busy || available <= 0}
              onClick={() => void apply()}
              className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 px-3 py-2 text-xs font-bold text-slate-950"
            >
              {busy ? 'Applying…' : 'Confirm swap'}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveCutId(null);
                setReplacementId(null);
              }}
              className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-[11px] text-slate-400">{message}</p>}
    </div>
  );
}
