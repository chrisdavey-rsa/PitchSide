/**
 * Dynamic workspace for emerging sports (F1 grid + Golf tiers).
 * Football/Rugby stay in PredictionsPage / MatchPredictor.
 */

import React from 'react';
import type { EmergingSportKey } from '../types';
import { useF1DriversQuery } from '../hooks/useEmergingSports';
import F1GridPredictor from './f1/F1GridPredictor';
import GolfTierPredictor from './golf/GolfTierPredictor';

export type EmergingSportWorkspaceProps = {
  sport: EmergingSportKey;
  userId: string;
  className?: string;
};

export default function EmergingSportWorkspace({
  sport,
  userId,
  className = '',
}: EmergingSportWorkspaceProps) {
  const { data: drivers = [] } = useF1DriversQuery();

  if (sport === 'formula1') {
    return (
      <div
        className={`bg-slate-900/60 rounded-3xl border border-slate-800 shadow-xl p-4 sm:p-6 w-full space-y-4 ${className}`}
      >
        <header className="border-b border-slate-800/80 pb-5">
          <h2 className="text-xl font-bold font-display text-white">
            Formula 1 Grid
          </h2>
          <p className="mt-1 text-xs text-slate-500 font-sans">
            Qualifying top 10, then race top 6 + fastest lap.
          </p>
        </header>
        <F1GridPredictor drivers={drivers} />
      </div>
    );
  }

  return (
    <div
      className={`bg-slate-900/60 rounded-3xl border border-slate-800 shadow-xl p-4 sm:p-6 w-full ${className}`}
    >
      <GolfTierPredictor userId={userId} />
    </div>
  );
}
