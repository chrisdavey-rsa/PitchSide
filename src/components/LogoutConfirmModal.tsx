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
 * Primary action keeps the player in the app; secondary confirms logout.
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
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl p-6 space-y-5 animate-fade-in">
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
            onClick={onCancel}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm font-display transition-colors cursor-pointer"
          >
            No, return to app
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-3 rounded-xl border border-slate-700 bg-slate-950/60 hover:bg-red-950/40 hover:border-red-500/40 text-slate-300 hover:text-red-300 font-semibold text-sm font-mono uppercase tracking-wider transition-colors cursor-pointer"
          >
            Yes, log out
          </button>
        </div>
      </div>
    </div>
  );
}
