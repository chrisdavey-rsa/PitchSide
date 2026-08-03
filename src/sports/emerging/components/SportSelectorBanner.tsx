/**
 * Horizontal sport selector banner for the predictions workspace.
 * Football / Rugby are active; Golf / F1 show as Coming Soon (disabled).
 */

import React from 'react';
import { Lock } from 'lucide-react';
import { SportIcon } from '../sportIcons';
import type { SportKey } from '../types';

export type SportSelectorBannerProps = {
  activeSport: SportKey;
  onSelectSport: (sport: SportKey) => void;
  /** Kept for API compatibility; Golf/F1 are Coming Soon for all roles. */
  userRole?: string | null;
  className?: string;
};

const PILLS: { key: SportKey; label: string; comingSoon?: boolean }[] = [
  { key: 'football', label: 'Football' },
  { key: 'rugby', label: 'Rugby' },
  { key: 'formula1', label: 'F1', comingSoon: true },
  { key: 'golf', label: 'Golf', comingSoon: true },
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
  className = '',
}: SportSelectorBannerProps) {
  return (
    <div
      role="tablist"
      aria-label="Sport workspace"
      className={`grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-xl bg-slate-950/70 border border-slate-800 ${className}`}
    >
      {PILLS.map(({ key, label, comingSoon }) => {
        const active = activeSport === key && !comingSoon;

        if (comingSoon) {
          return (
            <span
              key={key}
              role="tab"
              aria-selected={false}
              aria-disabled="true"
              title="Coming soon"
              className={`${PILL_BASE} opacity-50 pointer-events-none cursor-not-allowed bg-transparent text-slate-500 border-transparent`}
            >
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <SportIcon sport={key} colored className="h-7 w-7 sm:h-8 sm:w-8 opacity-60" />
              <span className="truncate flex flex-col items-start leading-tight">
                <span>{label}</span>
                <span className="text-[8px] font-mono uppercase tracking-wider text-slate-600">
                  Coming Soon
                </span>
              </span>
            </span>
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
                : 'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'
            }`}
          >
            <SportIcon sport={key} colored className="h-7 w-7 sm:h-8 sm:w-8" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
