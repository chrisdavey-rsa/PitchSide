/**
 * Universal prediction confirm control — centred PitchSide "P." mark only.
 */

import React from 'react';
import PitchSideMark from './PitchSideMark';

export type ConfirmPicksButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  /** Visual locked / submitted state (green emphasis). */
  confirmed?: boolean;
  className?: string;
  'aria-label'?: string;
  id?: string;
};

export default function ConfirmPicksButton({
  onClick,
  disabled = false,
  confirmed = false,
  className = '',
  'aria-label': ariaLabel = 'Confirm picks',
  id,
}: ConfirmPicksButtonProps) {
  return (
    <button
      id={id}
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-xl px-5 py-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        confirmed
          ? 'bg-emerald-500 border-2 border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.45)]'
          : 'bg-slate-950/60 border-2 border-emerald-500/40 hover:border-emerald-400 shadow-md shadow-emerald-500/10 cursor-pointer'
      } ${className}`}
    >
      <PitchSideMark size={28} className="rounded-lg shrink-0" />
    </button>
  );
}
