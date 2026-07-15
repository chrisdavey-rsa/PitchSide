/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronRight,
  ShieldAlert,
  Plus,
  Minus,
  Sparkles,
  Users,
} from "lucide-react";
import { SportType, Competition, Match } from "../../types";
import { getCompetitions } from "../../competitions";
import { MetallicTickWithLightning } from "./shared";
import LockGuessButton from "./LockGuessButton";
import SportIntroModal from "../onboarding/SportIntroModal";
import PowerUpModal from "../powerups/PowerUpModal";
import { getPowerUp } from "../../data/powerUps";

/** Wallet chips: power-up id paired with its current (hardcoded) status. */
const WALLET_CHIPS: { id: string; status: string }[] = [
  { id: "urc-shield-bank", status: "1 Available" },
  { id: "ucl-joker", status: "Arsenal" },
];

interface MatchPredictorProps {
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
  predictions: Record<string, { home: number; away: number; submitted: boolean }>;
  isEmailVerified: boolean;
  onScoreChange: (matchId: string, side: "home" | "away", val: string) => void;
  onRugbyPredictionChange: (matchId: string, winner: "home" | "away" | "draw" | null, marginStr: string) => void;
  onSubmitPrediction: (matchId: string) => void;
}

export default function MatchPredictor({
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
  onScoreChange,
  onRugbyPredictionChange,
  onSubmitPrediction,
}: MatchPredictorProps) {
  const [fbHover, setFbHover] = useState(false);
  const [rbHover, setRbHover] = useState(false);

  // Just-in-time onboarding: show a sport intro the first time a player opens
  // a Football or Rugby competition (tracked per-sport in localStorage).
  const [introSport, setIntroSport] = useState<"football" | "rugby" | null>(null);

  useEffect(() => {
    if (
      selectedSport === SportType.FOOTBALL &&
      !localStorage.getItem("hasSeenFootballIntro")
    ) {
      setIntroSport("football");
    } else if (
      selectedSport === SportType.RUGBY &&
      !localStorage.getItem("hasSeenRugbyIntro")
    ) {
      setIntroSport("rugby");
    }
  }, [selectedSport]);

  const dismissIntro = () => {
    if (introSport === "football") {
      localStorage.setItem("hasSeenFootballIntro", "true");
    } else if (introSport === "rugby") {
      localStorage.setItem("hasSeenRugbyIntro", "true");
    }
    setIntroSport(null);
  };

  // Power-up explainer modal opened from the wallet chips.
  const [activePowerUp, setActivePowerUp] = useState<string | null>(null);

  return (
    <>
      <AnimatePresence>
        {introSport && (
          <SportIntroModal sport={introSport} onDismiss={dismissIntro} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activePowerUp && (
          <PowerUpModal
            powerUpId={activePowerUp}
            onClose={() => setActivePowerUp(null)}
          />
        )}
      </AnimatePresence>

      {/* TWO LARGE TILE BUTTONS SECTION (Football & Rugby) */}
          <div id="tour-match-predictor" className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Football Sport Tile Card */}
              <div
                id="football-sport-tile"
                onClick={() => {
                  setSelectedSport(SportType.FOOTBALL);
                  const comps = getCompetitions().filter((c) => c.sport === SportType.FOOTBALL);
                  setSelectedCompId(comps.length > 0 ? comps[0].id : null);
                }}
                onMouseEnter={() => setFbHover(true)}
                onMouseLeave={() => setFbHover(false)}
                className={`relative rounded-3xl p-8 border-2 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between group min-h-[220px] ${
                  selectedSport === SportType.FOOTBALL
                    ? "bg-blue-950/40 border-blue-500 shadow-[0_0_24px_rgba(59,130,246,0.35)]"
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:shadow-lg shadow-sm"
                }`}
              >
                {/* Background Ambient Glow */}
                <div
                  className={`absolute -right-12 -bottom-12 w-48 h-48 rounded-full blur-3xl opacity-20 transition-all ${
                    selectedSport === SportType.FOOTBALL
                      ? "bg-blue-500 opacity-30"
                      : "bg-slate-500 group-hover:bg-blue-500"
                  }`}
                />

                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-extrabold font-display text-white group-hover:text-blue-300 transition-colors">
                      FOOTBALL
                    </h2>
                    <p className="text-slate-400 text-xs max-w-xs pt-1 font-sans">
                      Predict goal lines across Premier League, Champions
                      League, Europa rosters and FIFA divisions.
                    </p>
                  </div>

                  {/* Silhouette outline of a Football */}
                  <div
                    className={`relative p-3.5 rounded-full transition-all duration-500 flex items-center justify-center ${fbHover ? "scale-105 bg-blue-950/15 text-blue-400" : "text-slate-400"}`}
                  >
                    {/* Slower, more professional motion transform on the icon itself */}
                    <motion.div
                      animate={
                        fbHover
                          ? { rotate: 25, scale: 1.08 }
                          : { rotate: 0, scale: 1 }
                      }
                      transition={{
                        type: "spring",
                        stiffness: 80,
                        damping: 15,
                      }}
                      className="w-14 h-14 relative flex items-center justify-center"
                    >
                      {/* Modern Classical design Soccer ball icon SVG */}
                      <svg
                        className="w-full h-full relative z-10"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        {/* Central Pentagonal Panel */}
                        <polygon
                          points="12,7.5 15.2,9.8 14,13.6 10,13.6 8.8,9.8"
                          fill="currentColor"
                          fillOpacity="0.25"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        {/* Outer Seam lines radiating from the pentagon vertices */}
                        <line
                          x1="12"
                          y1="7.5"
                          x2="12"
                          y2="2"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        <line
                          x1="15.2"
                          y1="9.8"
                          x2="19.8"
                          y2="8.3"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        <line
                          x1="14"
                          y1="13.6"
                          x2="17.8"
                          y2="18.6"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        <line
                          x1="10"
                          y1="13.6"
                          x2="6.2"
                          y2="18.6"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        <line
                          x1="8.8"
                          y1="9.8"
                          x2="4.2"
                          y2="8.3"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        {/* 3D Curved peripheral accent lines */}
                        <path
                          d="M4.2 8.3 C6.5 5.5, 9.5 3.5, 12 2"
                          stroke="currentColor"
                          strokeWidth="0.8"
                          className="opacity-60"
                        />
                        <path
                          d="M19.8 8.3 C17.5 5.5, 14.5 3.5, 12 2"
                          stroke="currentColor"
                          strokeWidth="0.8"
                          className="opacity-60"
                        />
                        <path
                          d="M19.8 8.3 C20.8 11.5, 20.1 15.3, 17.8 18.6"
                          stroke="currentColor"
                          strokeWidth="0.8"
                          className="opacity-60"
                        />
                        <path
                          d="M4.2 8.3 C3.2 11.5, 3.9 15.3, 6.2 18.6"
                          stroke="currentColor"
                          strokeWidth="0.8"
                          className="opacity-60"
                        />
                        <path
                          d="M6.2 18.6 C9.5 19.8, 14.5 19.8, 17.8 18.6"
                          stroke="currentColor"
                          strokeWidth="0.8"
                          className="opacity-60"
                        />
                      </svg>

                      {/* Animated lightning flash circling the soccer ball itself */}
                      {fbHover && (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            repeat: Infinity,
                            duration: 4,
                            ease: "linear",
                          }}
                          className="absolute inset-0 pointer-events-none z-20"
                        >
                          <svg
                            className="w-full h-full absolute inset-0"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="10.8"
                              stroke="url(#fbLightningGrad)"
                              strokeWidth="1.5"
                              strokeDasharray="5, 12"
                              className="opacity-100"
                              style={{
                                filter:
                                  "drop-shadow(0 0 4px #3b82f6) drop-shadow(0 0 8px #60a5fa)",
                              }}
                            />
                            <defs>
                              <linearGradient
                                id="fbLightningGrad"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop
                                  offset="50%"
                                  stopColor="#60a5fa"
                                  stopOpacity="0.8"
                                />
                                <stop offset="100%" stopColor="#3b82f6" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </motion.div>
                      )}
                    </motion.div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-6 font-mono text-xs text-blue-400 group-hover:translate-x-1 transition-transform">
                  <span>Choose Football leagues</span>{" "}
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {/* Rugby Sport Tile Card */}
              <div
                id="rugby-sport-tile"
                onClick={() => {
                  setSelectedSport(SportType.RUGBY);
                  const comps = getCompetitions().filter((c) => c.sport === SportType.RUGBY);
                  setSelectedCompId(comps.length > 0 ? comps[0].id : null);
                }}
                onMouseEnter={() => setRbHover(true)}
                onMouseLeave={() => setRbHover(false)}
                className={`relative rounded-3xl p-8 border-2 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between group min-h-[220px] ${
                  selectedSport === SportType.RUGBY
                    ? "bg-amber-950/40 border-amber-500 shadow-[0_0_24px_rgba(245,158,11,0.35)]"
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:shadow-lg shadow-sm"
                }`}
              >
                {/* Background Ambient Glow */}
                <div
                  className={`absolute -right-12 -bottom-12 w-48 h-48 rounded-full blur-3xl opacity-20 transition-all ${
                    selectedSport === SportType.RUGBY
                      ? "bg-amber-500 opacity-30"
                      : "bg-slate-500 group-hover:bg-amber-500"
                  }`}
                />

                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-extrabold font-display text-white group-hover:text-amber-300 transition-colors">
                      RUGBY
                    </h2>
                    <p className="text-slate-400 text-xs max-w-xs pt-1 font-sans">
                      Predict winning score margins across Six Nations,
                      Heineken, Top 14, and Rugby Worlds brackets.
                    </p>
                  </div>

                  {/* Silhouette outline of a Rugby Ball */}
                  <div
                    className={`relative p-3.5 rounded-full transition-all duration-500 flex items-center justify-center ${rbHover ? "scale-105 bg-amber-950/15 text-amber-400" : "text-slate-400"}`}
                  >
                    {/* Slower, more professional motion transform on the icon itself */}
                    <motion.div
                      animate={
                        rbHover
                          ? { rotate: -15, scale: 1.08 }
                          : { rotate: 0, scale: 1 }
                      }
                      transition={{
                        type: "spring",
                        stiffness: 80,
                        damping: 15,
                      }}
                      className="w-14 h-14 relative flex items-center justify-center"
                    >
                      {/* High-fidelity custom stitch Rugby Oval ball SVG */}
                      <svg
                        className="w-full h-full relative z-10"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <g transform="rotate(-30 12 12)">
                          <path
                            d="M12 2 C5.5 2, 2 7.5, 2 12 C2 16.5, 5.5 22, 12 22 C18.5 22, 22 16.5, 22 12 C22 7.5, 18.5 2, 12 2 Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            fill="currentColor"
                            fillOpacity="0.12"
                          />
                          <path
                            d="M12 2 C8 6, 8 18, 12 22"
                            stroke="currentColor"
                            strokeWidth="1"
                            className="opacity-80"
                          />
                          <path
                            d="M12 2 C16 6, 16 18, 12 22"
                            stroke="currentColor"
                            strokeWidth="1"
                            className="opacity-80"
                          />

                          {/* Centered Laces / Seam Stitching */}
                          <line
                            x1="12"
                            y1="5.5"
                            x2="12"
                            y2="18.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                          <line
                            x1="9.5"
                            y1="8"
                            x2="14.5"
                            y2="8"
                            stroke="currentColor"
                            strokeWidth="1.3"
                          />
                          <line
                            x1="9"
                            y1="10.5"
                            x2="15"
                            y2="10.5"
                            stroke="currentColor"
                            strokeWidth="1.3"
                          />
                          <line
                            x1="9"
                            y1="13"
                            x2="15"
                            y2="13"
                            stroke="currentColor"
                            strokeWidth="1.3"
                          />
                          <line
                            x1="9.5"
                            y1="15.5"
                            x2="14.5"
                            y2="15.5"
                            stroke="currentColor"
                            strokeWidth="1.3"
                          />
                        </g>
                      </svg>

                      {/* Animated lightning flash circling the rugby ball itself */}
                      {rbHover && (
                        <motion.div
                          animate={{ rotate: -360 }}
                          transition={{
                            repeat: Infinity,
                            duration: 4,
                            ease: "linear",
                          }}
                          className="absolute inset-0 pointer-events-none z-20"
                        >
                          <svg
                            className="w-full h-full absolute inset-0"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="10.8"
                              stroke="url(#rbLightningGrad)"
                              strokeWidth="1.5"
                              strokeDasharray="5, 12"
                              className="opacity-100"
                              style={{
                                filter:
                                  "drop-shadow(0 0 4px #f59e0b) drop-shadow(0 0 8px #fbbf24)",
                              }}
                            />
                            <defs>
                              <linearGradient
                                id="rbLightningGrad"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop offset="0%" stopColor="#f59e0b" />
                                <stop
                                  offset="50%"
                                  stopColor="#fbbf24"
                                  stopOpacity="0.8"
                                />
                                <stop offset="100%" stopColor="#f59e0b" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </motion.div>
                      )}
                    </motion.div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-6 font-mono text-xs text-amber-400 group-hover:translate-x-1 transition-transform">
                  <span>Choose Rugby leagues</span>{" "}
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>

          {/* DETAILED DRILL-DOWN SUB VIEW */}
          {selectedSport && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/60 rounded-3xl border border-slate-800 p-6 shadow-xl"
            >
              {/* Leagues filtering tab */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 mb-5">
                <div>
                  <span className="text-[10px] uppercase font-bold font-mono tracking-widest text-emerald-400">
                    Live Division Filters
                  </span>
                  <h3 className="text-xl font-bold font-display text-white mt-0.5">
                    {selectedSport === SportType.FOOTBALL
                      ? "Football Leagues"
                      : "Rugby Leagues"}{" "}
                    Included
                  </h3>
                </div>

                {/* Quick stats segment */}
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>Selected Competitions:</span>
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

              {/* Grid list of leagues targeting future wrapping layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredCompetitions.map((comp) => {
                  const count = allMatches.filter(
                    (m) => m.competitionId === comp.id,
                  ).length;
                  const isSelected = selectedCompId === comp.id;

                  return (
                    <button
                      id={`comp-btn-${comp.id}`}
                      key={comp.id}
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
                          {comp.nationality || "International"}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
                          count > 0
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        {count > 0 ? `${count} Fixture` : "Scheduled"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* FIREFIGHTING NO MATCH MESSAGE */}
              {!selectedCompId && (
                <div className="text-center py-10 text-slate-500 font-sans text-xs">
                  ðŸ‘ˆ Select one of the competitions above to load action items
                  and configure score predictions.
                </div>
              )}

              {/* SPECIFIC COMPETITION FIXTURES PREDICTOR */}
              {selectedCompId && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 pt-5 border-t border-slate-800 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                    <div>
                      <h4 className="text-sm font-bold font-display text-white">
                        {selectedCompetition?.name} Match Day Predicter
                      </h4>
                      <p className="text-xs text-slate-400">
                        Input your predictions below.
                      </p>
                    </div>

                  </div>

                  {/* POWER-UP WALLET: strategic assets — tap a chip to learn more */}
                  <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-800/70 bg-slate-950/30 px-4 py-3">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mr-1">
                      Power-Up Wallet
                    </span>

                    {WALLET_CHIPS.map((chip) => {
                      const powerUp = getPowerUp(chip.id);
                      if (!powerUp) return null;
                      const Icon = powerUp.icon;
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => setActivePowerUp(chip.id)}
                          title={`${powerUp.name} — tap for details`}
                          className={`group flex items-center gap-2 rounded-lg border ${powerUp.theme.border} ${powerUp.theme.bg} px-3 py-1.5 text-left transition-all hover:brightness-125 hover:-translate-y-px cursor-pointer`}
                        >
                          <Icon className={`h-4 w-4 ${powerUp.theme.iconText}`} />
                          <span className="flex flex-col leading-tight">
                            <span className={`text-[11px] font-bold font-display ${powerUp.theme.accentText}`}>
                              {powerUp.name}
                            </span>
                            <span className="text-[9px] font-mono uppercase tracking-wide text-slate-500">
                              {chip.status}
                            </span>
                          </span>
                        </button>
                      );
                    })}

                    <span className="ml-auto text-[9px] font-mono uppercase tracking-widest text-slate-600">
                      Tap to learn
                    </span>
                  </div>

                  {activeMatches.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500 font-sans">
                      No matches loaded for this collection. Expand matches by
                      editing fixtures draft lists.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortedActiveMatches.map((match, index) => {
                        const matchDate = new Date(match.matchDate);
                        const dateKey = matchDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                        const timeKey = matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        const prevMatch = index > 0 ? sortedActiveMatches[index - 1] : null;
                        const prevDateKey = prevMatch ? new Date(prevMatch.matchDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : null;
                        const showDateSeparator = dateKey !== prevDateKey;

                        const savedPred = predictions[match.id] || {
                          home: 0,
                          away: 0,
                          submitted: false,
                        };
                        const isSubmitted = savedPred.submitted;
                        const isMatchStarted =
                          new Date() > new Date(match.matchDate);
                        const isLocked = isSubmitted || isMatchStarted;
                        return (
                          <React.Fragment key={match.id}>
                            {showDateSeparator && (
                              <div className="text-center pt-4 pb-2">
                                <span className="inline-block text-slate-300 text-xs font-semibold px-4 py-1.5 uppercase tracking-widest font-mono">
                                  {dateKey}
                                </span>
                              </div>
                            )}
                            <div
                              className={`relative p-5 rounded-2xl border transition-all ${
                                match.matchTag
                                  ? "border-amber-500/30 bg-slate-900"
                                  : isLocked
                                  ? "bg-slate-900 border-blue-900/30"
                                  : "bg-slate-900/40 border-slate-800/40"
                              }`}
                            >
                              {/* HIGH STAKES TAG: premium gold/neon badge with a subtle pulse */}
                              {match.matchTag && (
                                <div className="absolute -top-2.5 left-4 z-10">
                                  <motion.span
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="relative inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-slate-950/90 px-2.5 py-0.5 text-[9px] font-bold font-mono uppercase tracking-widest text-amber-300"
                                  >
                                    <motion.span
                                      aria-hidden
                                      animate={{ opacity: [0.35, 0.8, 0.35] }}
                                      transition={{
                                        repeat: Infinity,
                                        duration: 2.4,
                                        ease: "easeInOut",
                                      }}
                                      className="pointer-events-none absolute inset-0 rounded-full border border-amber-300/50 shadow-[0_0_12px_rgba(251,191,36,0.45)]"
                                    />
                                    <Sparkles className="relative h-2.5 w-2.5" />
                                    <span className="relative">{match.matchTag}</span>
                                  </motion.span>
                                </div>
                              )}

                              {/* Top Row: Date, Time, Action Button */}
                              <div className="flex justify-between items-center mb-6">
                                <div className="flex-1 hidden md:block"></div> {/* Left spacer for center alignment */}
                                
                                <div className="flex-1 flex flex-col items-center justify-center text-center">
                                  <span className="inline-block bg-slate-900 border border-slate-700 text-slate-400 text-[10px] font-mono px-3 py-0.5 rounded-full">
                                    {timeKey}
                                  </span>
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
                                    ) : isMatchStarted && !isSubmitted ? (
                                      <div className="w-full sm:w-auto flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-950/60 border border-slate-800 px-4 py-2.5 rounded-xl">
                                        <MetallicTickWithLightning />
                                        <span>Match Started</span>
                                      </div>
                                    ) : (
                                      <LockGuessButton
                                        id={`submit-pred-btn-${match.id}`}
                                        submitted={isSubmitted}
                                        onClick={() => onSubmitPrediction(match.id)}
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                              {/* Teams Scoring UI Rows */}
                              {match.sport === "football" ? (
                                <div className="w-full flex items-center justify-center gap-2 max-w-xl mx-auto">
                                  {/* Home Team */}
                                  <div className="flex-1 text-right">
                                    <h5 className="font-extrabold font-display text-sm tracking-tight text-white mb-0.5">
                                      {match.homeTeam}
                                    </h5>
                                  </div>

                                  {/* Central Inputs and VS */}
                                  <div className="flex flex-none items-center gap-2 px-1">
                                    {/* Home Input Interactors */}
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

                                    {/* Versus divider */}
                                    <div className="text-center font-mono font-bold text-slate-600 text-[10px] uppercase tracking-widest">
                                      vs
                                    </div>

                                    {/* Away Input Interactors */}
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
                                  </div>

                                  {/* Away Team */}
                                  <div className="flex-1 text-left">
                                    <h5 className="font-extrabold font-display text-sm tracking-tight text-white mb-0.5">
                                      {match.awayTeam}
                                    </h5>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex-1 w-full flex flex-col items-center gap-3 bg-slate-950/40 p-4 border border-slate-850/60 rounded-2xl relative">
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
                                      className={`px-2 py-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                                        (savedPred.home || 0) >
                                        (savedPred.away || 0)
                                          ? "bg-emerald-550/10 border-emerald-500/40 text-emerald-300"
                                          : "bg-slate-950/20 border-slate-850 text-slate-500 hover:bg-slate-900/50 hover:text-slate-350"
                                      }`}
                                    >
                                      <span className="text-[8px] font-mono text-slate-500 uppercase font-bold mb-0.5">
                                        Home Win
                                      </span>
                                      <span className="font-display font-black text-center truncate w-full">
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
                                      className={`px-2 py-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                                        (savedPred.home || 0) ===
                                        (savedPred.away || 0)
                                          ? "bg-emerald-550/10 border-emerald-500/40 text-emerald-300"
                                          : "bg-slate-950/20 border-slate-850 text-slate-500 hover:bg-slate-900/50 hover:text-slate-350"
                                      }`}
                                    >
                                      <span className="text-[8px] font-mono text-slate-500 uppercase font-bold mb-0.5">
                                        Draw
                                      </span>
                                      <span className="font-display font-black text-center truncate w-full">
                                        Equal Points
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
                                      className={`px-2 py-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                                        (savedPred.away || 0) >
                                        (savedPred.home || 0)
                                          ? "bg-emerald-555/10 border-emerald-500/40 text-emerald-300"
                                          : "bg-slate-950/20 border-slate-850 text-slate-500 hover:bg-slate-900/50 hover:text-slate-350"
                                      }`}
                                    >
                                      <span className="text-[8px] font-mono text-slate-500 uppercase font-bold mb-0.5">
                                        Away Win
                                      </span>
                                      <span className="font-display font-black text-center truncate w-full">
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
                                          Draw (Equal Points)
                                        </span>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </div>

                            {/* ANTICIPATION MECHANIC: consensus stays hidden until the guess is locked */}
                            {isSubmitted && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
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
                              </motion.div>
                            )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}
    </>
  );
}
