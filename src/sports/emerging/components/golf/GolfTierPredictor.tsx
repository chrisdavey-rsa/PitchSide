/**
 * Golf Majors tier predictor scaffolding (5 tiers + mulligan panel).
 * Isolated from Football/Rugby prediction systems.
 */

import React, { useMemo, useState } from 'react';
import CountryFlag from '../../../../components/CountryFlag';
import ConfirmPicksButton from '../../../../components/ConfirmPicksButton';
import { useGolfPlayersQuery } from '../../hooks/useEmergingSports';
import EmergingSearchCombobox from '../EmergingSearchCombobox';
import GolfMulliganPanel, { type GolfRosterEntry } from './GolfMulliganPanel';

export type GolfTierId =
  | 'winner'
  | 'top5'
  | 'top10'
  | 'top20'
  | 'make_cut';

const TIERS: { id: GolfTierId; label: string; hint: string }[] = [
  { id: 'winner', label: 'Tournament Winner', hint: '1 pick' },
  { id: 'top5', label: 'Top 5', hint: '1 pick' },
  { id: 'top10', label: 'Top 10', hint: '1 pick' },
  { id: 'top20', label: 'Top 20', hint: '1 pick' },
  { id: 'make_cut', label: 'Make the Cut', hint: '1 pick' },
];

export type GolfTierPredictorProps = {
  userId: string;
  className?: string;
  onConfirm?: (picks: Record<GolfTierId, string | null>) => void;
};

export default function GolfTierPredictor({
  userId,
  className = '',
  onConfirm,
}: GolfTierPredictorProps) {
  const { data: golfers = [] } = useGolfPlayersQuery();
  const [picks, setPicks] = useState<Record<GolfTierId, string | null>>({
    winner: null,
    top5: null,
    top10: null,
    top20: null,
    make_cut: null,
  });
  const [confirmed, setConfirmed] = useState(false);

  const byId = useMemo(
    () => new Map(golfers.map((g) => [g.id, g] as const)),
    [golfers],
  );

  const usedIds = useMemo(
    () => new Set(Object.values(picks).filter((id): id is string => !!id)),
    [picks],
  );

  const optionsFor = (tier: GolfTierId) =>
    golfers
      .filter((g) => !usedIds.has(g.id) || picks[tier] === g.id)
      .map((g) => ({
        id: g.id,
        label: g.name,
        countryCode: g.countryCode,
      }));

  const setTier = (tier: GolfTierId, playerId: string | null) => {
    setPicks((prev) => ({ ...prev, [tier]: playerId }));
    setConfirmed(false);
  };

  const roster: GolfRosterEntry[] = useMemo(
    () =>
      (Object.values(picks).filter(Boolean) as string[]).map((playerId) => ({
        playerId,
        missedCut: false,
      })),
    [picks],
  );

  const filled = TIERS.every((t) => !!picks[t.id]);

  const confirm = () => {
    if (!filled) return;
    setConfirmed(true);
    onConfirm?.(picks);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <header className="space-y-1">
        <h2 className="text-lg font-display font-extrabold text-white tracking-tight">
          Golf Majors
        </h2>
        <p className="text-xs text-slate-500 font-sans">
          Build your five-tier card. One unique golfer per tier.
        </p>
      </header>

      <div className="space-y-3">
        {TIERS.map((tier, index) => {
          const selected = picks[tier.id]
            ? byId.get(picks[tier.id]!)
            : undefined;
          return (
            <div
              key={tier.id}
              className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 sm:p-4"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[10px] text-emerald-400/90 tabular-nums">
                    T{index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">
                      {tier.label}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {tier.hint}
                    </div>
                  </div>
                </div>
                {selected && (
                  <div className="flex items-center gap-1.5 shrink-0 text-xs text-slate-300">
                    <CountryFlag code={selected.countryCode} size={14} />
                    <span className="font-medium truncate max-w-[9rem]">
                      {selected.name}
                    </span>
                  </div>
                )}
              </div>
              <EmergingSearchCombobox
                label={`Pick · ${tier.label}`}
                placeholder="Search golfers…"
                options={optionsFor(tier.id)}
                value={picks[tier.id]}
                onChange={(id) => setTier(tier.id, id)}
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ConfirmPicksButton
          disabled={!filled}
          confirmed={confirmed}
          onClick={confirm}
          aria-label={confirmed ? 'Golf card locked' : 'Confirm golf card'}
          className="min-w-[4.5rem]"
        />
        <button
          type="button"
          onClick={() => {
            setPicks({
              winner: null,
              top5: null,
              top10: null,
              top20: null,
              make_cut: null,
            });
            setConfirmed(false);
          }}
          className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-900"
        >
          Reset
        </button>
      </div>

      <GolfMulliganPanel
        userId={userId}
        roster={roster}
        mulliganWindowOpen={false}
      />
    </div>
  );
}
