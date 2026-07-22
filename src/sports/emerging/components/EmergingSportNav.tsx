/**
 * Feature-flagged sports navigation for Golf + Formula 1 (and core sports labels).
 * Players: Golf / F1 are greyscale + inactive (no badges / notify CTAs).
 * Admins: Golf / F1 are fully interactive.
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
  const visible = showCoreSports
    ? ITEMS
    : ITEMS.filter((i) => i.kind === 'emerging');

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
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                  : 'text-slate-300 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <SportIcon sport={item.key} colored className="h-5 w-5" />
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-semibold">{item.label}</span>
                <span className="block text-[10px] text-slate-500 font-mono">
                  Active
                </span>
              </div>
            </button>
          );
        }

        const meta = EMERGING_SPORT_META[item.key];
        const accessible = isSportAccessible(item.key, userRole);

        if (accessible) {
          const active = selectedSport === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectSport(item.key)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                active
                  ? 'bg-violet-500/15 text-violet-200 border border-violet-500/30'
                  : 'text-slate-300 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <SportIcon sport={item.key} colored className="h-5 w-5" />
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-semibold">{meta.label}</span>
                <span className="block text-[10px] text-violet-400/80 font-mono">
                  Admin preview
                </span>
              </div>
            </button>
          );
        }

        // Player / locked: greyscale, non-interactive, no badge or notify CTA.
        return (
          <div
            key={item.key}
            role="presentation"
            aria-disabled="true"
            className="rounded-xl border border-slate-800/90 bg-slate-900/40 px-3 py-2.5 flex items-center gap-3 opacity-45 select-none pointer-events-none grayscale"
          >
            <SportIcon sport={item.key} colored={false} className="h-5 w-5" />
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-slate-400">
                {meta.label}
              </span>
              <span className="block text-[10px] text-slate-500 font-mono italic">
                Coming soon…
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
