/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Ticket, X, Sparkles, Plus, Minus, Trophy } from "lucide-react";
import { UserProfile, SportType, Match } from "../../types";
import { dbSavePrediction } from "../../supabase";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryKeys";
import { useMatchesQuery } from "../../hooks/usePitchsideQueries";

// Hardcoded identifiers for the one-off Community Shield "Golden Ticket" fixture.
export const COMMUNITY_SHIELD_MATCH_ID = "f-communityshield";
export const COMMUNITY_SHIELD_COMPETITION_ID = "f-shield";
export const COMMUNITY_SHIELD_KICKOFF = new Date("2026-08-09T15:00:00Z");

// True while we are still before kickoff and the event should be offered.
export function isCommunityShieldOpen(now: Date = new Date()): boolean {
  return now.getTime() < COMMUNITY_SHIELD_KICKOFF.getTime();
}

/**
 * A Community Shield game is "scheduled" when an un-played fixture exists for the
 * Community Shield competition. The Golden Ticket promo/rule only appears when
 * there is actually a game to predict.
 */
export function isCommunityShieldScheduled(matches: Match[]): boolean {
  return matches.some(
    (m) =>
      m.competitionId === COMMUNITY_SHIELD_COMPETITION_ID &&
      m.status !== "completed",
  );
}

/** Hook variant that reads fixtures from the query cache (also merges locally-added ones). */
export function useCommunityShieldScheduled(): boolean {
  const { data: dbMatches = [] } = useMatchesQuery();
  return useMemo(() => {
    let localMatches: Match[] = [];
    try {
      const saved = localStorage.getItem("added_fixtures");
      localMatches = saved ? (JSON.parse(saved) as Match[]) : [];
    } catch {
      localMatches = [];
    }
    return isCommunityShieldScheduled([...dbMatches, ...localMatches]);
  }, [dbMatches]);
}

interface CommunityShieldEventProps {
  user: UserProfile;
  onClose: () => void;
  triggerToast: (message: string) => void;
}

function ScoreStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-amber-200/80">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-lg bg-slate-950/60 border border-amber-500/30 text-amber-200 hover:bg-slate-900 flex items-center justify-center cursor-pointer transition-colors"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="w-14 h-14 rounded-xl bg-gradient-to-b from-amber-400/20 to-amber-600/10 border border-amber-400/40 flex items-center justify-center">
          <span className="text-3xl font-black font-display text-amber-100">{value}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(30, value + 1))}
          className="w-8 h-8 rounded-lg bg-slate-950/60 border border-amber-500/30 text-amber-200 hover:bg-slate-900 flex items-center justify-center cursor-pointer transition-colors"
          aria-label={`Increase ${label}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function CommunityShieldEvent({
  user,
  onClose,
  triggerToast,
}: CommunityShieldEventProps) {
  const queryClient = useQueryClient();
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await dbSavePrediction(
        user.id,
        COMMUNITY_SHIELD_MATCH_ID,
        SportType.FOOTBALL,
        COMMUNITY_SHIELD_COMPETITION_ID,
        home,
        away,
        true,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.predictions(user.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard });
      triggerToast("🎫 Golden Ticket entry locked in. Good luck!");
      onClose();
    } catch (e) {
      console.warn("Community Shield prediction failed:", e);
      triggerToast("Could not save your Golden Ticket entry. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: "spring", damping: 22, stiffness: 300 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-400/40 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 shadow-[0_0_60px_rgba(245,158,11,0.25)]"
      >
        {/* Ambient golden glow */}
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-400/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 w-56 h-56 bg-yellow-500/10 rounded-full blur-3xl" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-amber-200/70 hover:text-white transition-colors cursor-pointer"
          title="Maybe later"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative p-7 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-yellow-600 shadow-lg shadow-amber-900/40">
            <Ticket className="h-8 w-8 text-slate-950" />
          </div>

          <div className="mb-1 flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-amber-300">
              Golden Ticket Event
            </span>
            <Sparkles className="h-4 w-4 text-amber-300" />
          </div>

          <h2 className="font-display text-2xl font-extrabold text-white">Football is back.</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-slate-300">
            Predict the <span className="font-bold text-amber-200">exact score</span> of the
            Community Shield to win a <span className="font-bold text-amber-200">Golden Ticket</span>.
          </p>

          <div className="mt-6 flex items-center justify-center gap-5 rounded-2xl border border-amber-500/20 bg-slate-950/50 py-5">
            <ScoreStepper label="Home" value={home} onChange={setHome} />
            <div className="flex flex-col items-center">
              <Trophy className="mb-1 h-5 w-5 text-amber-400" />
              <span className="text-lg font-black text-slate-600">vs</span>
            </div>
            <ScoreStepper label="Away" value={away} onChange={setAway} />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3 font-display text-sm font-bold uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-900/40 transition-all hover:from-amber-300 hover:to-yellow-400 disabled:opacity-60 cursor-pointer"
          >
            {submitting ? "Locking in..." : "Lock In My Prediction"}
          </button>

          <button
            onClick={onClose}
            className="mt-3 w-full text-[10px] font-mono uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
          >
            Maybe later
          </button>
        </div>
      </motion.div>
    </div>
  );
}
