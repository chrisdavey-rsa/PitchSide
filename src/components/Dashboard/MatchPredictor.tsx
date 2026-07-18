/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "motion/react";
import {
  ShieldAlert,
  Plus,
  Minus,
  Sparkles,
  Users,
} from "lucide-react";
import { SportType, Competition, Match } from "../../types";
import { calculatePoints } from "../../utils";
import LockGuessButton from "./LockGuessButton";
import SportIntroModal from "../onboarding/SportIntroModal";
import { getPowerUp } from "../../data/powerUps";
import type { PredictionEntry } from "../../supabase";
import SportEntryTile from "./SportEntryTile";
import { useOverlayHistory } from "../../hooks/useOverlayHistory";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import {
  SeenFeature,
  hasSeenFeature,
  type SeenFeatureKey,
  type SeenFeatures,
} from "../../lib/seenFeatures";

/** Wallet chips: power-up id paired with its current (hardcoded) status. */
const WALLET_CHIPS: { id: string; status: string }[] = [
  { id: "urc-shield-bank", status: "1 Available" },
  { id: "ucl-joker", status: "Arsenal" },
];

function getMatchStatusDisplay(match: Match) {
  if (match.status === "completed") {
    return {
      label: "Finished",
      className:
        "text-green-500 font-mono text-[10px] uppercase tracking-widest font-bold",
    };
  }
  if (match.status === "live") {
    return {
      label: "In play",
      className:
        "text-green-500 font-mono text-[10px] uppercase tracking-widest font-bold animate-pulse",
    };
  }
  return {
    label: "To be played",
    className:
      "text-slate-400 font-mono text-[10px] uppercase tracking-widest font-bold",
  };
}

interface MatchPredictorProps {
  /** `page` = Predictions tab (no giant sport tiles). `classic` = legacy tiles. */
  layout?: "classic" | "page";
  isUserInAnyLeague: boolean;
  selectedSport: SportType | null;
  setSelectedSport: (sport: SportType | null) => void;
  selectedCompId: string | null;
  setSelectedCompId: (id: string | null) => void;
  allMatches: Match[];
  sortedActiveMatches: Match[];
  activeMatches: Match[];
  filteredCompetitions: Competition[];
  selectedCompetition?: Competition;
  predictions: Record<string, PredictionEntry>;
  isEmailVerified: boolean;
  seenFeatures?: SeenFeatures;
  onFeatureSeen: (featureKey: SeenFeatureKey) => void | Promise<unknown>;
  onScoreChange: (matchId: string, side: "home" | "away", val: string) => void;
  onRugbyPredictionChange: (matchId: string, winner: "home" | "away" | "draw" | null, marginStr: string) => void;
  onSubmitPrediction: (matchId: string) => void;
}

/** Kickoff key: same calendar day + clock minute → one visual group. */
function kickoffGroupKey(matchDate: string): string {
  const d = new Date(matchDate);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}T${d.getHours()}:${d.getMinutes()}`;
}

function kickoffGroupLabel(matchDate: string): string {
  const d = new Date(matchDate);
  const datePart = d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timePart = d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} · ${timePart}`;
}

export default function MatchPredictor({
  layout = "classic",
  selectedSport,
  setSelectedSport,
  selectedCompId,
  setSelectedCompId,
  allMatches,
  sortedActiveMatches,
  activeMatches,
  filteredCompetitions,
  selectedCompetition,
  predictions,
  isEmailVerified,
  seenFeatures,
  onFeatureSeen,
  onScoreChange,
  onRugbyPredictionChange,
  onSubmitPrediction,
}: MatchPredictorProps) {
  const isPage = layout === "page";
  // Just-in-time onboarding: first open of Football / Rugby (profiles.seen_features).
  const [introSport, setIntroSport] = useState<"football" | "rugby" | null>(null);

  useEffect(() => {
    if (
      selectedSport === SportType.FOOTBALL &&
      !hasSeenFeature(seenFeatures, SeenFeature.FootballIntro)
    ) {
      setIntroSport("football");
    } else if (
      selectedSport === SportType.RUGBY &&
      !hasSeenFeature(seenFeatures, SeenFeature.RugbyIntro)
    ) {
      setIntroSport("rugby");
    } else {
      setIntroSport(null);
    }
  }, [selectedSport, seenFeatures]);

  const dismissIntro = useCallback(() => {
    setIntroSport((current) => {
      if (current === "football") {
        void onFeatureSeen(SeenFeature.FootballIntro);
      } else if (current === "rugby") {
        void onFeatureSeen(SeenFeature.RugbyIntro);
      }
      return null;
    });
  }, [onFeatureSeen]);

  useBodyScrollLock(!!introSport);
  useOverlayHistory(!!introSport, dismissIntro, "sport-intro");

  return (
    <>
      <AnimatePresence>
        {introSport && (
          <SportIntroModal sport={introSport} onDismiss={dismissIntro} />
        )}
      </AnimatePresence>

      {/* Classic layout: large Football / Rugby entry tiles */}
      {!isPage && (
          <div
            id="tour-match-predictor"
            className="grid grid-cols-2 md:grid-cols-2 gap-3 sm:gap-6 pt-2 auto-rows-fr"
          >
              <SportEntryTile
                id="football-sport-tile"
                sport="football"
                selected={selectedSport === SportType.FOOTBALL}
                onSelect={() => setSelectedSport(SportType.FOOTBALL)}
              />

              <SportEntryTile
                id="rugby-sport-tile"
                sport="rugby"
                selected={selectedSport === SportType.RUGBY}
                onSelect={() => setSelectedSport(SportType.RUGBY)}
              />
            </div>
      )}

          {/* DETAILED DRILL-DOWN SUB VIEW */}
          {selectedSport && (
            <div
              id={isPage ? "tour-match-predictor" : undefined}
              className={`bg-slate-900/60 rounded-3xl border border-slate-800 shadow-xl ${
                isPage ? "p-4 sm:p-6 w-full" : "p-6"
              }`}
            >
              {/* Leagues filtering tab */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 mb-5">
                <div>
                  <h3 className="text-xl font-bold font-display text-white">
                    {selectedSport === SportType.FOOTBALL
                      ? "Football Leagues"
                      : "Rugby Leagues"}
                  </h3>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>Total Competitions:</span>
                  <span
                    className={`px-2 py-0.5 rounded-sm font-mono text-xs font-semibold ${
                      selectedSport === SportType.FOOTBALL
                        ? "bg-blue-500/10 text-blue-300"
                        : "bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {filteredCompetitions.length}
                  </span>
                </div>
              </div>

              {/* Grid list of competitions with active/upcoming fixtures */}
              {filteredCompetitions.length === 0 ? (
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 px-6 py-14 text-center">
                  <p className="text-sm font-display font-semibold text-slate-200">
                    No active fixtures available for this game-week.
                  </p>
                  <p className="mt-2 text-xs text-slate-500 font-sans max-w-sm mx-auto leading-relaxed">
                    When live or upcoming matches are synced for{" "}
                    {selectedSport === SportType.FOOTBALL ? "football" : "rugby"},
                    their competitions will appear here automatically.
                  </p>
                </div>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredCompetitions.map((comp) => {
                  const count = allMatches.filter(
                    (m) => m.competitionId === comp.id && m.status !== "completed",
                  ).length;
                  const isSelected = selectedCompId === comp.id;

                  return (
                    <button
                      id={`comp-btn-${comp.id}`}
                      key={comp.id}
                      type="button"
                      onClick={() => setSelectedCompId(comp.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-slate-950 border-emerald-500 text-white shadow-md"
                          : "bg-slate-950/40 border-slate-800/50 hover:border-slate-700 hover:bg-slate-950/80 text-slate-300"
                      }`}
                    >
                      <div>
                        <h4 className="text-xs font-semibold font-display tracking-tight text-white">
                          {comp.name}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Live schedule
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
                          count > 0
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        {count > 0 ? `${count} Fixture${count === 1 ? "" : "s"}` : "Scheduled"}
                      </span>
                    </button>
                  );
                })}
              </div>
              )}

              {/* Prompt when comps exist but none selected yet */}
              {filteredCompetitions.length > 0 && !selectedCompId && (
                <div className="text-center py-10 text-slate-500 font-sans text-xs">
                  Select one of the competitions above to load action items
                  and configure score predictions.
                </div>
              )}

              {/* SPECIFIC COMPETITION FIXTURES PREDICTOR */}
              {selectedCompId && filteredCompetitions.length > 0 && (
                <div className="mt-6 pt-5 border-t border-slate-800 space-y-4">
                  {/* POWER-UP WALLET: inactive launch teaser (coming soon) */}
                  <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center rounded-xl border border-slate-800/70 bg-slate-950/30 px-4 py-3">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 shrink-0">
                      Power-Up Wallet
                    </span>

                    <div className="grid grid-cols-2 gap-2 md:flex md:flex-row md:flex-wrap md:items-center md:gap-2.5">
                      {WALLET_CHIPS.map((chip) => {
                        const powerUp = getPowerUp(chip.id);
                        if (!powerUp) return null;
                        const Icon = powerUp.icon;
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            disabled
                            aria-disabled="true"
                            title={`${powerUp.name} — coming soon`}
                            className="relative flex items-center justify-center md:justify-start gap-2 rounded-lg border border-slate-700 bg-slate-800 w-full md:w-auto p-2.5 md:px-3 md:py-1.5 text-left text-slate-500 cursor-not-allowed opacity-90"
                          >
                            <Icon className="relative z-10 h-5 w-5 md:h-4 md:w-4 text-slate-500" />
                            <span className="hidden md:flex flex-col leading-tight relative z-10">
                              <span className="text-[11px] font-bold font-display text-slate-400">
                                {powerUp.name}
                              </span>
                              <span className="text-[9px] font-mono uppercase tracking-wide text-slate-600">
                                Coming soon
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <span className="hidden md:block md:ml-auto text-[9px] font-mono uppercase tracking-widest text-slate-600 shrink-0">
                      Launch locked
                    </span>
                  </div>

                  {activeMatches.length === 0 ? (
                    <div className="rounded-xl border border-slate-800/70 bg-slate-950/30 px-5 py-10 text-center">
                      <p className="text-sm font-display font-semibold text-slate-200">
                        No active fixtures available for this game-week.
                      </p>
                      <p className="mt-2 text-xs text-slate-500 font-sans">
                        Check back once upcoming fixtures are synced for this competition.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 w-full">
                      {sortedActiveMatches.map((match, index) => {
                        const matchDate = new Date(match.matchDate);
                        const timeKey = matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const groupKey = kickoffGroupKey(match.matchDate);
                        const prevMatch = index > 0 ? sortedActiveMatches[index - 1] : null;
                        const prevGroupKey = prevMatch
                          ? kickoffGroupKey(prevMatch.matchDate)
                          : null;
                        const showKickoffHeader = groupKey !== prevGroupKey;

                        const savedPred = predictions[match.id] || {
                          home: 0,
                          away: 0,
                          submitted: false,
                          provisionalPoints: 0,
                        };
                        const hasPick = Object.prototype.hasOwnProperty.call(
                          predictions,
                          match.id,
                        );
                        const isSubmitted = savedPred.submitted;
                        const homeLeading = (savedPred.home || 0) > (savedPred.away || 0);
                        const awayLeading = (savedPred.away || 0) > (savedPred.home || 0);
                        const isDrawPick =
                          hasPick &&
                          (savedPred.home || 0) === (savedPred.away || 0);
                        const showActiveGreen = hasPick || isSubmitted;
                        const isLive = match.status === "live";
                        const isMatchStarted =
                          isLive || new Date() > new Date(match.matchDate);
                        const isLocked = isSubmitted || isMatchStarted;

                        // As It Stands: prefer live-computed points from provisional
                        // scores; fall back to the DB provisional_points field.
                        const liveHome = match.provisionalHomeScore;
                        const liveAway = match.provisionalAwayScore;
                        const asItStandsPoints =
                          isLive &&
                          isSubmitted &&
                          liveHome != null &&
                          liveAway != null
                            ? calculatePoints(
                                match.sport,
                                savedPred.home,
                                savedPred.away,
                                liveHome,
                                liveAway,
                              )
                            : savedPred.provisionalPoints ?? 0;

                        const matchStatus = getMatchStatusDisplay(match);

                        return (
                          <React.Fragment key={match.id}>
                            {showKickoffHeader && (
                              <div className="text-center pt-4 pb-2">
                                <span className="inline-block text-slate-300 text-[11px] font-semibold px-4 py-1.5 uppercase tracking-wider font-mono">
                                  {kickoffGroupLabel(match.matchDate)}
                                </span>
                              </div>
                            )}
                            <div
                              className={`relative p-4 sm:p-5 rounded-2xl border transition-all w-full ${
                                isLive
                                  ? "border-rose-500/40 bg-slate-900 shadow-[0_0_24px_rgba(244,63,94,0.08)]"
                                  : showActiveGreen
                                  ? "border-emerald-500 bg-slate-900 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
                                  : match.matchTag
                                  ? "border-amber-500/30 bg-slate-900"
                                  : isLocked
                                  ? "bg-slate-900 border-blue-900/30"
                                  : "bg-slate-900/40 border-slate-800/40"
                              }`}
                            >
                              {/* HIGH STAKES TAG: premium gold/neon badge with a subtle pulse */}
                              {match.matchTag && (
                                <div className="absolute -top-2.5 left-4 z-10">
                                  <span className="relative inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-slate-950/90 px-2.5 py-0.5 text-[9px] font-bold font-mono uppercase tracking-widest text-amber-300">
                                    <Sparkles className="relative h-2.5 w-2.5" />
                                    <span className="relative">{match.matchTag}</span>
                                  </span>
                                </div>
                              )}

                              {/* Top Row: Live clock / kickoff time + Action Button */}
                              <div className="flex justify-between items-center mb-6">
                                <div className="flex-1 hidden md:block"></div>
                                
                                <div className="flex-1 flex flex-col items-center justify-center text-center gap-1.5">
                                  {match.roundName && (
                                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
                                      {match.roundName}
                                    </span>
                                  )}
                                  {isLive ? (
                                    <>
                                      <span className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/40 text-rose-300 text-[10px] font-mono font-bold px-3 py-0.5 rounded-full uppercase tracking-widest">
                                        <span className="relative flex h-2 w-2">
                                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                                          <span className="relative inline-flex h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                                        </span>
                                        Live
                                        {match.matchMinute && (
                                          <span className="text-rose-200/90">{match.matchMinute}</span>
                                        )}
                                      </span>
                                      <span className="font-display font-black text-2xl tracking-widest text-white tabular-nums">
                                        {liveHome ?? "–"}
                                        <span className="mx-1.5 text-slate-500">–</span>
                                        {liveAway ?? "–"}
                                      </span>
                                      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
                                        As It Stands
                                      </span>
                                    </>
                                  ) : (
                                    <span className="inline-block bg-slate-900 border border-slate-700 text-slate-400 text-[10px] font-mono px-3 py-0.5 rounded-full">
                                      {timeKey}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex-1 flex justify-end">
                                  <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2.5">
                                    {!isEmailVerified ? (
                                      <div
                                        className="w-full sm:w-auto bg-slate-800 text-slate-500 font-bold font-display uppercase text-xs px-5 py-3 rounded-xl flex items-center justify-center gap-1 shadow-md opacity-50 cursor-not-allowed"
                                        title="Please verify your email to submit predictions."
                                      >
                                        <ShieldAlert className="w-3.5 h-3.5" /> VERIFY EMAIL TO PLAY
                                      </div>
                                    ) : isLive && isSubmitted ? (
                                      <div className="w-full sm:w-auto flex flex-col items-center gap-0.5 text-xs font-mono bg-amber-500/10 border border-amber-500/30 px-4 py-2 rounded-xl">
                                        <span className="text-[9px] uppercase tracking-widest text-amber-500/80">
                                          As It Stands
                                        </span>
                                        <span className="font-display font-black text-amber-300 text-sm">
                                          {asItStandsPoints > 0 ? `+${asItStandsPoints}` : asItStandsPoints} pts
                                        </span>
                                      </div>
                                    ) : !isMatchStarted || isSubmitted ? (
                                      <LockGuessButton
                                        id={`submit-pred-btn-${match.id}`}
                                        submitted={isSubmitted}
                                        onClick={() => onSubmitPrediction(match.id)}
                                      />
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                              {/* Teams Scoring UI Rows */}
                              {match.sport === "football" ? (
                                <div className="w-full flex items-start justify-center gap-3 sm:gap-4 max-w-xl mx-auto">
                                  {/* Home Team */}
                                  <div className="flex-1 min-w-0 flex flex-col items-center text-center">
                                    <div className="flex items-center justify-center gap-1 bg-slate-950 px-1.5 py-1 rounded-xl border border-slate-800 focus-within:border-emerald-500/50 transition-all">
                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => {
                                          const val = Math.max(
                                            0,
                                            (savedPred.home || 0) - 1,
                                          );
                                          onScoreChange(
                                            match.id,
                                            "home",
                                            val.toString(),
                                          );
                                        }}
                                        className="relative p-1 rounded-sm bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer overflow-hidden group select-none"
                                      >
                                        <div className="absolute inset-[-100%] z-0 group-hover:animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#10b981_100%)] opacity-0 group-hover:opacity-100" />
                                        <div className="absolute inset-[1px] bg-slate-900 rounded-sm z-0" />
                                        <Minus className="w-2.5 h-2.5 relative z-10" />
                                      </button>

                                      <input
                                        id={`pred-home-val-${match.id}`}
                                        type="number"
                                        min={0}
                                        max={99}
                                        disabled={isLocked}
                                        value={savedPred.home}
                                        onChange={(e) =>
                                          onScoreChange(
                                            match.id,
                                            "home",
                                            e.target.value,
                                          )
                                        }
                                        className="w-8 text-center bg-transparent border-0 font-display font-black text-white text-base focus:ring-0 outline-hidden pointer-events-auto p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />

                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => {
                                          const val = (savedPred.home || 0) + 1;
                                          onScoreChange(
                                            match.id,
                                            "home",
                                            val.toString(),
                                          );
                                        }}
                                        className="relative p-1 rounded-sm bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer overflow-hidden group select-none"
                                      >
                                        <div className="absolute inset-[-100%] z-0 group-hover:animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#10b981_100%)] opacity-0 group-hover:opacity-100" />
                                        <div className="absolute inset-[1px] bg-slate-900 rounded-sm z-0" />
                                        <Plus className="w-2.5 h-2.5 relative z-10" />
                                      </button>
                                    </div>
                                    <h5
                                      className={`mt-2 font-extrabold font-display text-[11px] sm:text-sm tracking-tight truncate w-full max-w-full leading-snug px-0.5 ${
                                        showActiveGreen && homeLeading
                                          ? "text-emerald-400"
                                          : showActiveGreen && isDrawPick
                                            ? "text-emerald-300/80"
                                            : "text-white"
                                      }`}
                                      title={match.homeTeam}
                                    >
                                      {match.homeTeam}
                                    </h5>
                                  </div>

                                  <div className="shrink-0 flex flex-col items-center justify-center text-center gap-1 px-1 pt-2">
                                    <span className={matchStatus.className}>
                                      {matchStatus.label}
                                    </span>
                                    <span className="font-mono font-bold text-slate-600 text-[10px] uppercase tracking-widest">
                                      vs
                                    </span>
                                  </div>

                                  {/* Away Team */}
                                  <div className="flex-1 min-w-0 flex flex-col items-center text-center">
                                    <div className="flex items-center justify-center gap-1 bg-slate-950 px-1.5 py-1 rounded-xl border border-slate-800 focus-within:border-emerald-500/50 transition-all">
                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => {
                                          const val = Math.max(
                                            0,
                                            (savedPred.away || 0) - 1,
                                          );
                                          onScoreChange(
                                            match.id,
                                            "away",
                                            val.toString(),
                                          );
                                        }}
                                        className="relative p-1 rounded-sm bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer overflow-hidden group select-none"
                                      >
                                        <div className="absolute inset-[-100%] z-0 group-hover:animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#10b981_100%)] opacity-0 group-hover:opacity-100" />
                                        <div className="absolute inset-[1px] bg-slate-900 rounded-sm z-0" />
                                        <Minus className="w-2.5 h-2.5 relative z-10" />
                                      </button>

                                      <input
                                        id={`pred-away-val-${match.id}`}
                                        type="number"
                                        min={0}
                                        max={99}
                                        disabled={isLocked}
                                        value={savedPred.away}
                                        onChange={(e) =>
                                          onScoreChange(
                                            match.id,
                                            "away",
                                            e.target.value,
                                          )
                                        }
                                        className="w-8 text-center bg-transparent border-0 font-display font-black text-white text-base focus:ring-0 outline-hidden pointer-events-auto p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />

                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => {
                                          const val = (savedPred.away || 0) + 1;
                                          onScoreChange(
                                            match.id,
                                            "away",
                                            val.toString(),
                                          );
                                        }}
                                        className="relative p-1 rounded-sm bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer overflow-hidden group select-none"
                                      >
                                        <div className="absolute inset-[-100%] z-0 group-hover:animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#10b981_100%)] opacity-0 group-hover:opacity-100" />
                                        <div className="absolute inset-[1px] bg-slate-900 rounded-sm z-0" />
                                        <Plus className="w-2.5 h-2.5 relative z-10" />
                                      </button>
                                    </div>
                                    <h5
                                      className={`mt-2 font-extrabold font-display text-[11px] sm:text-sm tracking-tight truncate w-full max-w-full leading-snug px-0.5 ${
                                        showActiveGreen && awayLeading
                                          ? "text-emerald-400"
                                          : showActiveGreen && isDrawPick
                                            ? "text-emerald-300/80"
                                            : "text-white"
                                      }`}
                                      title={match.awayTeam}
                                    >
                                      {match.awayTeam}
                                    </h5>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex-1 w-full flex flex-col items-center gap-3 bg-slate-950/40 p-3 sm:p-4 border border-slate-850/60 rounded-2xl relative">
                                  <span className={matchStatus.className}>
                                    {matchStatus.label}
                                  </span>
                                  {/* Winner Selection Segment */}
                                  <div className="w-full grid grid-cols-3 gap-2">
                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => {
                                        const currentMargin =
                                          Math.abs(
                                            (savedPred.home || 0) -
                                              (savedPred.away || 0),
                                          ) || 1;
                                        onRugbyPredictionChange(
                                          match.id,
                                          "home",
                                          currentMargin.toString(),
                                        );
                                      }}
                                      className={`px-1.5 py-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer select-none min-w-0 ${
                                        homeLeading
                                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                                          : "bg-slate-950/20 border-slate-850 text-slate-500 hover:bg-slate-900/50 hover:text-slate-350"
                                      }`}
                                    >
                                      <span
                                        className={`font-display font-black text-center truncate w-full text-[11px] sm:text-xs ${
                                          homeLeading ? "text-emerald-400" : ""
                                        }`}
                                        title={match.homeTeam}
                                      >
                                        {match.homeTeam}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => {
                                        onRugbyPredictionChange(
                                          match.id,
                                          "draw",
                                          "0",
                                        );
                                      }}
                                      className={`px-1.5 py-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer select-none min-w-0 ${
                                        isDrawPick ||
                                        ((savedPred.home || 0) ===
                                          (savedPred.away || 0) &&
                                          hasPick)
                                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                                          : "bg-slate-950/20 border-slate-850 text-slate-500 hover:bg-slate-900/50 hover:text-slate-350"
                                      }`}
                                    >
                                      <span
                                        className={`font-display font-black text-center w-full text-[11px] sm:text-xs ${
                                          isDrawPick ? "text-emerald-400" : ""
                                        }`}
                                      >
                                        Draw
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => {
                                        const currentMargin =
                                          Math.abs(
                                            (savedPred.home || 0) -
                                              (savedPred.away || 0),
                                          ) || 1;
                                        onRugbyPredictionChange(
                                          match.id,
                                          "away",
                                          currentMargin.toString(),
                                        );
                                      }}
                                      className={`px-1.5 py-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer select-none min-w-0 ${
                                        awayLeading
                                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                                          : "bg-slate-950/20 border-slate-850 text-slate-500 hover:bg-slate-900/50 hover:text-slate-350"
                                      }`}
                                    >
                                      <span
                                        className={`font-display font-black text-center truncate w-full text-[11px] sm:text-xs ${
                                          awayLeading ? "text-emerald-400" : ""
                                        }`}
                                        title={match.awayTeam}
                                      >
                                        {match.awayTeam}
                                      </span>
                                    </button>
                                  </div>

                                  {/* Margin Dropdown / Text Representation */}
                                  {(savedPred.home || 0) !== (savedPred.away || 0) ? (
                                    isSubmitted ? (
                                      <div className="flex flex-col items-center text-center mt-2 w-full bg-slate-900/50 py-3 px-4 rounded-xl border border-emerald-500/20">
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-1 select-none">
                                          Your Prediction
                                        </span>
                                        <span className="font-display font-black text-emerald-400 text-sm">
                                          {(savedPred.home || 0) > (savedPred.away || 0) ? match.homeTeam : match.awayTeam} by {Math.abs((savedPred.home || 0) - (savedPred.away || 0))} {(Math.abs((savedPred.home || 0) - (savedPred.away || 0)) === 1 ? 'Point' : 'Points')}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center text-center mt-2 w-full">
                                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-emerald-405 mb-1.5 select-none">
                                          Winning Margin (Points)
                                        </span>
                                        <select
                                          disabled={isLocked}
                                          value={Math.abs(
                                            (savedPred.home || 0) -
                                              (savedPred.away || 0),
                                          ).toString()}
                                          onChange={(e) => {
                                            const currentWinner =
                                              (savedPred.home || 0) >
                                              (savedPred.away || 0)
                                                ? "home"
                                                : "away";
                                            onRugbyPredictionChange(
                                              match.id,
                                              currentWinner,
                                              e.target.value,
                                            );
                                          }}
                                          className="w-full max-w-[200px] text-center bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-2 px-3 font-display font-bold text-white text-sm outline-hidden"
                                        >
                                          {Array.from(
                                            { length: 100 },
                                            (_, i) => i + 1,
                                          ).map((num) => (
                                            <option key={num} value={num}>
                                              {num}{" "}
                                              {num === 1 ? "Point" : "Points"}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )
                                  ) : (
                                    isSubmitted && (
                                      <div className="flex flex-col items-center text-center mt-2 w-full bg-slate-900/50 py-3 px-4 rounded-xl border border-emerald-500/20">
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-1 select-none">
                                          Your Prediction
                                        </span>
                                        <span className="font-display font-black text-emerald-400 text-sm">
                                          Draw
                                        </span>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </div>

                            {/* ANTICIPATION MECHANIC: consensus stays hidden until the guess is locked */}
                            {isSubmitted && (
                              <div
                                className="mt-5 border-t border-slate-800/60 pt-4 overflow-hidden"
                              >
                                <div className="flex items-center justify-center gap-1.5">
                                  <Users className="h-3.5 w-3.5 text-slate-600" />
                                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
                                    Community Consensus
                                  </span>
                                </div>
                                <p className="mt-1 text-center text-xs italic text-slate-600">
                                  Consensus revealing soon…
                                </p>
                              </div>
                            )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
    </>
  );
}
