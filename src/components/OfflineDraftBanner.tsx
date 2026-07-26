import React from "react";
import { WifiOff, Wifi, Upload } from "lucide-react";

interface OfflineDraftBannerProps {
  isOffline: boolean;
  /** True when a local draft exists for the current event. */
  hasDraft: boolean;
  onApplyAndSubmit?: () => void | Promise<void>;
  /** Disable the apply button while a submit is in flight. */
  applying?: boolean;
}

/**
 * Amber offline notice, or restored-connection banner when a draft is waiting.
 */
export default function OfflineDraftBanner({
  isOffline,
  hasDraft,
  onApplyAndSubmit,
  applying = false,
}: OfflineDraftBannerProps) {
  if (isOffline) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-100"
      >
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-xs font-sans leading-relaxed">
          Offline mode. Predictions will be saved locally as a draft.
        </p>
      </div>
    );
  }

  if (!hasDraft) return null;

  return (
    <div
      role="status"
      className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sky-100"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <p className="text-xs font-sans leading-relaxed">
          Online connection restored. You have a saved draft.
        </p>
      </div>
      {onApplyAndSubmit && (
        <button
          type="button"
          disabled={applying}
          onClick={() => void onApplyAndSubmit()}
          className="inline-flex items-center justify-center gap-1.5 shrink-0 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-[11px] font-bold font-display uppercase tracking-wide text-white cursor-pointer transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          {applying ? "Submitting…" : "Apply & Submit Draft"}
        </button>
      )}
    </div>
  );
}
