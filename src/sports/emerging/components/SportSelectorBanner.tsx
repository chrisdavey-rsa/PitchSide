/**
 * Horizontal sport selector banner for the predictions workspace.
 * Players: Football / Rugby only.
 * Admins: also Formula 1 / Golf (build preview).
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
  'relative h-14 w-full flex items-center justify-center gap-2 px-2 rounded-lg text-[11px] sm:text-sm font-semibold tracking-wide border transition-colors';

function pillActiveClass(key: SportKey): string {
  switch (key) {
    case 'football':
      return 'bg-blue-500/20 text-blue-100 border-blue-500/35 shadow-[inset_0_-2px_0_0_rgb(59_130_246)]';
    case 'rugby':
      return 'bg-amber-500/20 text-amber-100 border-amber-500/35 shadow-[inset_0_-2px_0_0_rgb(245_158_11)]';
    case 'formula1':
      return 'bg-red-500/20 text-red-100 border-red-500/35 shadow-[inset_0_-2px_0_0_rgb(239_68_68)]';
    case 'golf':
      return 'bg-emerald-500/20 text-emerald-100 border-emerald-500/35 shadow-[inset_0_-2px_0_0_rgb(16_185_129)]';
  }
}

export default function SportSelectorBanner({
  activeSport,
  onSelectSport,
  userRole,
  className = '',
}: SportSelectorBannerProps) {
  const visiblePills = PILLS.filter((p) => isSportAccessible(p.key, userRole));
  const gridClass =
    visiblePills.length <= 2
      ? 'grid-cols-2'
      : 'grid-cols-2 sm:grid-cols-4';

  return (
    <div
      role="tablist"
      aria-label="Sport workspace"
      className={`grid ${gridClass} gap-1.5 p-1.5 rounded-xl bg-slate-950/70 border border-slate-800 ${className}`}
    >
      {visiblePills.map(({ key, label }) => {
        const active = activeSport === key;
        const displayLabel =
          key === 'golf' || key === 'formula1'
            ? EMERGING_SPORT_META[key].label
            : label;

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
                : 'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'
            }`}
          >
            <SportIcon sport={key} colored className="h-7 w-7 sm:h-8 sm:w-8" />
            <span className="truncate">{displayLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
