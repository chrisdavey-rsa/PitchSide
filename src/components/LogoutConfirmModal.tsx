import React, { useEffect } from 'react';
import { LogOut } from 'lucide-react';
import AppModalShell from './modals/AppModalShell';

interface LogoutConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Centered confirmation before ending a session.
 * Stacked actions: Log out (destructive) then Cancel.
 */
export default function LogoutConfirmModal({
  open,
  onCancel,
  onConfirm,
}: LogoutConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <AppModalShell
      open={open}
      onClose={onCancel}
      zClass="z-[200]"
      maxWidthClass="max-w-sm"
      aria-labelledby="logout-confirm-title"
      panelClassName="rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl"
    >
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div className="flex flex-col items-center text-center gap-2 sm:gap-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3
              id="logout-confirm-title"
              className="text-sm sm:text-base font-bold font-display text-white tracking-wide"
            >
              Sign out of PitchSide?
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-400 font-sans leading-relaxed">
              You can sign back in anytime to manage your predictions.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-2.5 sm:py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm font-display cursor-pointer touch-manipulation"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2.5 sm:py-3 rounded-xl border border-slate-700 bg-slate-950/60 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-sm font-mono uppercase tracking-wider cursor-pointer touch-manipulation"
          >
            Cancel
          </button>
        </div>
      </div>
    </AppModalShell>
  );
}
