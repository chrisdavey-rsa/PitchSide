import React, { useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

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
  useBodyScrollLock(open);

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
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl p-6 space-y-5">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3
              id="logout-confirm-title"
              className="text-base font-bold font-display text-white tracking-wide"
            >
              Log out of PitchSide?
            </h3>
            <p className="mt-1.5 text-sm text-slate-400 font-sans leading-relaxed">
              Are you sure you want to log out?
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm font-display cursor-pointer"
          >
            Log out
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3 rounded-xl border border-slate-700 bg-slate-950/60 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-sm font-mono uppercase tracking-wider cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
