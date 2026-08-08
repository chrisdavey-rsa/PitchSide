import React, { useState } from "react";
import { Lock, X } from "lucide-react";
import { setSkipLockConfirm } from "../../lib/lockConfirmPrefs";
import AppModalShell from "../modals/AppModalShell";

type Props = {
  open: boolean;
  fixtureLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Confirms locking a prediction — once locked, the pick cannot change.
 */
export default function LockConfirmModal({
  open,
  fixtureLabel,
  onCancel,
  onConfirm,
}: Props) {
  const [dontShow, setDontShow] = useState(false);
  if (!open) return null;

  return (
    <AppModalShell
      open={open}
      onClose={onCancel}
      maxWidthClass="max-w-sm"
      aria-labelledby="lock-confirm-title"
      panelClassName="rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50"
    >
      <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10">
              <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
            </span>
            <div className="min-w-0">
              <h3
                id="lock-confirm-title"
                className="text-sm font-bold font-display text-white leading-snug"
              >
                Confirm?
              </h3>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5 leading-snug">
                Once you lock, you cannot change your pick for{" "}
                <span className="text-slate-200">{fixtureLabel}</span>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-500 hover:text-white cursor-pointer touch-manipulation"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dontShow}
            onChange={(e) => setDontShow(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500/40"
          />
          <span className="text-[11px] text-slate-400 font-sans leading-snug">
            I get it. Don&apos;t show me again
          </span>
        </label>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-10 rounded-xl border border-slate-700 bg-slate-950 text-slate-300 text-xs font-display font-bold uppercase tracking-wide cursor-pointer hover:border-slate-500 touch-manipulation"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (dontShow) setSkipLockConfirm(true);
              onConfirm();
            }}
            className="flex-1 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-display font-bold uppercase tracking-wide cursor-pointer touch-manipulation"
          >
            Lock pick
          </button>
        </div>
      </div>
    </AppModalShell>
  );
}
