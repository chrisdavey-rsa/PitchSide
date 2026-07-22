/**
 * Horizontal sport selector banner for the predictions workspace.
 * Fixed 4-column height so Football / Rugby / F1 / Golf match exactly.
 */

import React from 'react';
import { isSportAccessible } from '../featureFlags';
import { SportIcon } from '../sportIcons';
import {
  EMERGING_SPORT_META,
  type SportKey,
  type UserRole,
} from '../types';

export type SportSelectorBannerProps = {
  activeSport: SportKey;
  onSelectSport: (sport: SportKey) => void;
  userRole: UserRole;
  className?: string;
};

const PILLS: { key: SportKey; label: string }[] = [
  { key: 'football', label: 'Football' },
  { key: 'rugby', label: 'Rugby' },
  { key: 'formula1', label: 'Formula 1' },
  { key: 'golf', label: 'Golf' },
];

const PILL_BASE =
  'h-11 w-full flex items-center justify-center gap-2 px-2 rounded-lg text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider border transition-colors';

function pillActiveClass(key: SportKey): string {
  switch (key) {
    case 'football':
      return 'bg-blue-600 text-white shadow-md border-blue-500/40';
    case 'rugby':
      return 'bg-amber-600 text-white shadow-md border-amber-500/40';
    case 'formula1':
      return 'bg-red-600/90 text-white shadow-md border-red-500/40';
    case 'golf':
      return 'bg-emerald-600 text-white shadow-md border-emerald-500/40';
  }
}

export default function SportSelectorBanner({
  activeSport,
  onSelectSport,
  userRole,
  className = '',
}: SportSelectorBannerProps) {
  return (
    <div
      role="tablist"
      aria-label="Sport workspace"
      className={`grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-xl bg-slate-950/70 border border-slate-800 ${className}`}
    >
      {PILLS.map(({ key, label }) => {
        const accessible = isSportAccessible(key, userRole);
        const active = activeSport === key;
        const displayLabel =
          key === 'golf' || key === 'formula1'
            ? EMERGING_SPORT_META[key].label
            : label;

        if (!accessible) {
          return (
            <div
              key={key}
              role="tab"
              aria-selected={false}
              aria-disabled="true"
              className={`${PILL_BASE} opacity-45 grayscale select-none pointer-events-none border-slate-800/80 bg-slate-900/40 text-slate-500`}
            >
              <SportIcon sport={key} colored={false} className="h-4 w-4" />
              <span className="truncate">{displayLabel}</span>
            </div>
          );
        }

        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelectSport(key)}
            className={`${PILL_BASE} cursor-pointer ${
              active
                ? pillActiveClass(key)
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900 border-transparent'
            }`}
          >
            <SportIcon sport={key} colored className="h-4 w-4" />
            <span className="truncate">{displayLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
