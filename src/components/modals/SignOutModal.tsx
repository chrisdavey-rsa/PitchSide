import React, { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../../supabase";
import AppModalShell from "./AppModalShell";

interface SignOutModalProps {
  open: boolean;
  onCancel: () => void;
  /** Called after sign-out succeeds (or when auth is unavailable) so the host can clear session UI. */
  onSignedOut: () => void;
}

/**
 * Back-gesture / edge-swipe confirmation before ending a session.
 */
export default function SignOutModal({ open, onCancel, onSignedOut }: SignOutModalProps) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, busy]);

  if (!open) return null;

  const handleSignOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn("[SignOutModal] signOut failed:", err);
    } finally {
      onSignedOut();
      onCancel();
      setBusy(false);
    }
  };

  return (
    <AppModalShell
      open={open}
      onClose={busy ? undefined : onCancel}
      zClass="z-[200]"
      maxWidthClass="max-w-sm"
      aria-labelledby="sign-out-modal-title"
      panelClassName="rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl"
    >
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div className="flex flex-col items-center text-center gap-2 sm:gap-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3
              id="sign-out-modal-title"
              className="text-sm sm:text-base font-bold font-display text-white tracking-wide"
            >
              Want to sign out?
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-400 font-sans leading-relaxed">
              You will need to log back in to manage your prediction slips.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="w-full py-2.5 sm:py-3 rounded-xl border border-slate-700 bg-slate-950/60 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-sm font-mono uppercase tracking-wider cursor-pointer disabled:opacity-50 touch-manipulation"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSignOut()}
            className="w-full py-2.5 sm:py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm font-display cursor-pointer disabled:opacity-50 touch-manipulation"
          >
            {busy ? "Signing out…" : "Yes, Sign Out"}
          </button>
        </div>
      </div>
    </AppModalShell>
  );
}
