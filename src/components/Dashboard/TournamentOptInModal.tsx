import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  GOLF_TIER_BY_LEAGUE_ID,
  type GolfCoverageTier,
} from "../../constants/golfCoverage";
import TournamentListManager from "./TournamentListManager";

export type TournamentOptInSelection = {
  subscribedLeagues: string[];
  golfCoverageTier: GolfCoverageTier;
};

type TournamentOptInModalProps = {
  subscribedLeagues: readonly string[];
  golfCoverageTier: GolfCoverageTier;
  onClose: () => void;
  onSave: (next: TournamentOptInSelection) => Promise<void> | void;
};

/**
 * Opt-in modal: add leagues the user is not yet subscribed to.
 */
export default function TournamentOptInModal({
  subscribedLeagues,
  golfCoverageTier,
  onClose,
  onSave,
}: TournamentOptInModalProps) {
  const [pending, setPending] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (id: string) => {
    if (id.startsWith("g-") || id.startsWith("f1-")) return;
    setPending((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (pending.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const nextLeagues = [...new Set([...subscribedLeagues, ...pending])].filter(
        (id) => !id.startsWith("g-") && !id.startsWith("f1-"),
      );
      // Preserve existing golf tier id if present (read-only / coming soon).
      const existingGolf = subscribedLeagues.find((id) => id.startsWith("g-"));
      const finalLeagues = existingGolf
        ? [...nextLeagues, existingGolf]
        : nextLeagues;

      let nextGolf = golfCoverageTier;
      for (const id of pending) {
        const tier = GOLF_TIER_BY_LEAGUE_ID[id];
        if (tier) nextGolf = tier;
      }

      await onSave({
        subscribedLeagues: finalLeagues,
        golfCoverageTier: nextGolf,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = useMemo(() => pending.length, [pending]);

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-sm font-display font-bold text-white uppercase tracking-wide">
              Add Tournaments
            </h3>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5">
              Opt in to unlock feed tabs and predictions
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <TournamentListManager
            mode="add"
            subscribedLeagues={subscribedLeagues}
            selectedIds={pending}
            onToggle={toggle}
            golfCoverageTier={golfCoverageTier}
          />
        </div>

        <div className="px-4 py-3 border-t border-slate-800 shrink-0 space-y-2">
          {error ? (
            <p className="text-[10px] font-mono text-rose-400">{error}</p>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60"
          >
            {saving
              ? "Saving…"
              : pendingCount > 0
                ? `Add ${pendingCount} tournament${pendingCount === 1 ? "" : "s"}`
                : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
