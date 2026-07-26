/**
 * Feature-flagged sports navigation for Golf + Formula 1 (and core sports labels).
 * Players: Football / Rugby only.
 * Admins: also Golf / F1 (full interactive preview).
 */

import React from 'react';
import { isSportAccessible } from '../featureFlags';
import { SportIcon } from '../sportIcons';
import {
  EMERGING_SPORT_META,
  type EmergingSportKey,
  type SportKey,
  type UserRole,
} from '../types';

export type EmergingSportNavProps = {
  userId?: string;
  userRole: UserRole;
  selectedSport: SportKey | null;
  onSelectSport: (sport: SportKey) => void;
  /** Include Football/Rugby rows (read-only labels that call through). */
  showCoreSports?: boolean;
  className?: string;
};

type NavItem =
  | { kind: 'core'; key: 'football' | 'rugby'; label: string }
  | { kind: 'emerging'; key: EmergingSportKey };

const ITEMS: NavItem[] = [
  { kind: 'core', key: 'football', label: 'Football' },
  { kind: 'core', key: 'rugby', label: 'Rugby' },
  { kind: 'emerging', key: 'golf' },
  { kind: 'emerging', key: 'formula1' },
];

export default function EmergingSportNav({
  userRole,
  selectedSport,
  onSelectSport,
  showCoreSports = true,
  className = '',
}: EmergingSportNavProps) {
  const visible = (showCoreSports ? ITEMS : ITEMS.filter((i) => i.kind === 'emerging')).filter(
    (item) =>
      item.kind === 'core' || isSportAccessible(item.key, userRole),
  );

  return (
    <nav
      aria-label="Sports"
      className={`rounded-2xl border border-slate-800/80 bg-slate-950/70 p-2 space-y-1 ${className}`}
    >
      {visible.map((item) => {
        if (item.kind === 'core') {
          const active = selectedSport === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectSport(item.key)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                active
                  ? 'bg-slate-800 text-white border border-slate-600/80 shadow-[inset_0_-2px_0_0_rgb(52_211_153)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <SportIcon sport={item.key} colored className="h-8 w-8" />
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-semibold tracking-wide">{item.label}</span>
                <span className="block text-[10px] text-slate-500 font-mono">
                  Active
                </span>
              </div>
            </button>
          );
        }

        const meta = EMERGING_SPORT_META[item.key];
        const active = selectedSport === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectSport(item.key)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
              active
                ? 'bg-slate-800 text-white border border-slate-600/80 shadow-[inset_0_-2px_0_0_rgb(167_139_250)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <SportIcon sport={item.key} colored className="h-8 w-8" />
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-semibold tracking-wide">{meta.label}</span>
              <span className="block text-[10px] text-violet-400/80 font-mono">
                Admin preview
              </span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
