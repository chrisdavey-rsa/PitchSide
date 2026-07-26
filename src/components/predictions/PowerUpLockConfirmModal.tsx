import React from "react";
import { Lock, X } from "lucide-react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { getPowerUp, type PowerUpId } from "../../constants/powerups";

type Props = {
  open: boolean;
  powerUpId: PowerUpId;
  fixtureLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Confirms consuming a Power-Up when locking a prediction.
 */
export default function PowerUpLockConfirmModal({
  open,
  powerUpId,
  fixtureLabel,
  onCancel,
  onConfirm,
}: Props) {
  useBodyScrollLock(open);
  if (!open) return null;

  const def = getPowerUp(powerUpId);
  const name = def?.name ?? "Power-Up";
  const Icon = def?.icon;

  const contextualNote =
    powerUpId === "banker"
      ? "Note: Exact scores achieved via Banker chips do not count toward Precision Boost unlock progress."
      : powerUpId === "sniper"
        ? "Note: You must predict the exact score to earn the +50% bonus."
        : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="powerup-lock-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50 p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                  def?.isPremium
                    ? "border-amber-200/40 bg-slate-950"
                    : `${def?.theme.border ?? "border-slate-700"} bg-slate-950`
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    def?.isPremium ? "text-amber-200" : def?.theme.iconText
                  }`}
                />
              </span>
            )}
            <div className="min-w-0">
              <h3
                id="powerup-lock-title"
                className="text-sm font-bold font-display text-white leading-snug"
              >
                Confirm Power-Up
              </h3>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5 leading-snug">
                Apply {name} to {fixtureLabel}? This will consume the chip.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {contextualNote && (
          <p className="text-[10px] text-amber-200/85 font-sans leading-snug rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            {contextualNote}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2.5 text-xs font-bold font-display text-white cursor-pointer transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Lock className="h-3.5 w-3.5" />
            Confirm &amp; Lock
          </button>
        </div>
      </div>
    </div>
  );
}
