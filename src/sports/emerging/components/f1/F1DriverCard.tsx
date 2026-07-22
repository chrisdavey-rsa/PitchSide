/**
 * Driver list / pick card for the F1 grid predictor.
 * Root is a div so the whole card can own dnd-kit drag listeners.
 */

import React from 'react';
import CountryFlag from '../../../../components/CountryFlag';
import type { F1Driver } from '../../types';
import F1HelmetIcon from './F1HelmetIcon';

type Props = {
  driver: F1Driver;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  setNodeRef?: (node: HTMLElement | null) => void;
  dragAttributes?: React.HTMLAttributes<HTMLElement>;
  dragListeners?: React.HTMLAttributes<HTMLElement>;
};

export default function F1DriverCard({
  driver,
  selected = false,
  dimmed = false,
  onClick,
  className = '',
  style,
  setNodeRef,
  dragAttributes,
  dragListeners,
}: Props) {
  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      {...dragAttributes}
      {...dragListeners}
      className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all cursor-grab active:cursor-grabbing touch-none ${
        selected
          ? 'border-violet-400/50 bg-violet-500/15 ring-1 ring-violet-400/30'
          : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
      } ${dimmed ? 'opacity-45' : ''} ${className}`}
    >
      <F1HelmetIcon colorHex={driver.teamColorHex} className="h-9 w-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-100 truncate">
            {driver.name}
          </span>
          <CountryFlag code={driver.countryCode} size={14} alt="" />
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] font-mono text-slate-500">
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-slate-950 px-1 text-slate-300 border border-slate-700"
            style={{ borderColor: driver.teamColorHex || undefined }}
          >
            {driver.permanentNumber ?? '—'}
          </span>
          <span className="truncate">{driver.constructorName ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}
